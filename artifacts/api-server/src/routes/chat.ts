import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, conversationsTable, messagesTable, type MessageAttachment, type MessageToolCall } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireUser } from "../middlewares/requireAuth";
import { connectRouter, type RouterCreds } from "../lib/router-transport";
import { withOlt, type OltCreds } from "../lib/huawei-olt";

const router: IRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL!,
});

type Credentials = RouterCreds;

const READ_ONLY_SUBS = new Set(["print", "get", "export", "monitor-traffic", "monitor", "find"]);
function isMutating(command: string): boolean {
  const parts = command.trim().split(/\s+/);
  const sub = (parts[1] ?? "print").toLowerCase();
  return !READ_ONLY_SUBS.has(sub);
}

async function runRouterCommand(
  c: Credentials,
  command: string,
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  let client;
  try {
    client = await connectRouter(c);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    // SSH transport: just pipe the line through to the router shell.
    if (client.transport === "ssh") {
      const out = await client.exec(command.trim());
      client.close();
      return { ok: true, output: out.replace(/\r/g, "").trimEnd() || "(no output)" };
    }

    const trimmed = command.trim();
    const parts = trimmed.split(/\s+/);
    let menuPath = parts[0];
    if (!menuPath.startsWith("/")) menuPath = "/" + menuPath;
    const sub = (parts[1] ?? "print").toLowerCase();
    const argTokens = parts.slice(2);

    const args: Record<string, string> = {};
    let positional: string | undefined;
    for (const tok of argTokens) {
      const eq = tok.indexOf("=");
      if (eq > 0) {
        const k = tok.slice(0, eq);
        let v = tok.slice(eq + 1);
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        args[k] = v;
      } else if (!positional) {
        positional = tok;
      }
    }

    const menu = client.menu(menuPath);

    let output: unknown;
    switch (sub) {
      case "print":
      case "get":
      case "export": {
        output = await menu.get();
        break;
      }
      case "add": {
        const r = await menu.add(args);
        output = `Added: ${JSON.stringify(r)}`;
        break;
      }
      case "set": {
        if (positional) await menu.update(args, positional);
        else await menu.update(args);
        output = "Set successfully.";
        break;
      }
      case "remove": {
        if (!positional) throw new Error("remove requires an id/index argument");
        await menu.remove(positional);
        output = `Removed ${positional}.`;
        break;
      }
      case "enable": {
        if (!positional) throw new Error("enable requires an id/index argument");
        await menu.enable(positional);
        output = `Enabled ${positional}.`;
        break;
      }
      case "disable": {
        if (!positional) throw new Error("disable requires an id/index argument");
        await menu.disable(positional);
        output = `Disabled ${positional}.`;
        break;
      }
      default: {
        try {
          output = await menu.get();
        } catch {
          output = `Subcommand "${sub}" not supported. Use: print|get|add|set|remove|enable|disable`;
        }
      }
    }
    client.close();
    return { ok: true, output };
  } catch (err) {
    try { client.close(); } catch { /* ignore */ }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────── CHAT STREAM ───────────────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string }; title?: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

type Vendor = "mikrotik" | "huawei-olt";

type ChatBody = {
  messages: ChatMessage[];
  credentials?: Credentials;
  vendor?: Vendor;
  conversationId?: number;
  routerProfileId?: number;
  // Lightweight metadata about the latest user turn (for persistence — DB
  // does not need the full base64 image payload, only a description).
  latestUserAttachments?: MessageAttachment[];
  latestUserText?: string;
  routerIdentity?: string | null;
};

async function runOltCommand(
  c: OltCreds,
  command: string,
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  try {
    const out = await withOlt(c, async (s) => s.exec(command));
    return { ok: true, output: out || "(no output)" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const OLT_READ_VERBS = new Set([
  "display",
  "ping",
  "tracert",
  "traceroute",
  "show",
  "debug",
]);
function isOltMutating(command: string): boolean {
  const first = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!first) return false;
  if (OLT_READ_VERBS.has(first)) return false;
  // "quit" / "enable" / "config" are mode shifts, not mutations
  if (["quit", "enable", "config", "exit", "scroll", "save"].includes(first)) {
    // `save` writes config — count as mutating
    return first === "save";
  }
  return true;
}

const SYSTEM_PROMPT = `You are an expert MikroTik / RouterOS network engineer and BGP operator embedded inside the "MikroTik Access" web app. Your job is to help the user diagnose, configure, and troubleshoot their MikroTik router live.

## SCOPE — strict
You answer ONLY questions that are within the domain of:
- MikroTik / RouterOS / WinBox / Webfig (any version)
- Networking and internetworking: TCP/IP, IPv4/IPv6, routing (static, OSPF, BGP, MPLS, RIP), switching, VLANs, bridging, STP, ARP/NDP
- Firewalling, NAT, mangle, traffic shaping (queues, simple/tree, PCQ, HTB), QoS
- Wireless (CAPsMAN, WiFi, security, channel planning), tunnels (IPsec, EoIP, L2TP, WireGuard, GRE, OpenVPN, SSTP, PPTP), PPPoE, hotspot
- DHCP / DNS / NTP / SNMP / Syslog / RADIUS / DoT / DoH
- ISP and operator topics relevant to running a MikroTik (BGP peering, transit, IXPs, looking glasses, IRR, RPKI, prefix filtering, RPSL, ASNs, IPv4/IPv6 allocations)
- This MikroTik Access web app itself (how to use the connection screen, transports, role permissions, downloading config, etc.)

If the user asks ANYTHING outside this scope — travel, food, recipes, weather, sports, general trivia, math homework, movies, shopping, code unrelated to networking, life advice, etc. — politely refuse in ONE short sentence. Do NOT attempt the answer, do NOT provide a "quick answer though" preview, and do NOT suggest external resources beyond mentioning that this assistant is dedicated to MikroTik / networking help. Then offer to help with anything router-related.

Example refusal:
> That's outside what I'm here for — I'm dedicated to MikroTik and networking help only. Happy to dive into anything router, BGP, firewall or wireless related though.

Borderline-but-allowed: questions about general internet infrastructure (how DNS works, what an ASN is, how BGP path selection works, etc.) ARE in scope because they help the user operate their router. Use judgment — when in doubt, if the answer would help a network engineer, it's allowed.

## How you operate
- You are effectively logged into the user's router as an administrator. You can issue ANY RouterOS command using the \`run_router_command\` tool — exactly as if you had SSH'd in or opened a Terminal in WinBox. Configuration, troubleshooting, diagnostics, statistics, status display, monitoring, scripts — all of it is available to you. Each call opens a fresh session over the active transport (API-SSL / REST / SSH), runs the command, and returns the result.
- You should think and act like a senior MikroTik network engineer who has just opened a terminal on the box. Run \`/system/resource print\`, \`/interface/print stats\`, \`/ip/route/print\`, \`/routing/bgp/peer/print\`, \`/log/print\`, \`/tool/torch\`, \`/tool/traceroute\`, \`/ping\`, \`/tool/bandwidth-test\`, \`/system/script\`, etc. — whatever a human admin would run.
- For long-running tools (\`/ping\`, \`/tool/traceroute\`, \`/tool/torch\`, \`/tool/bandwidth-test\`, \`/log/print follow\`) ALWAYS bound them with \`count=N\` or \`duration=Ns\` so they terminate. Examples: \`/ping 8.8.8.8 count=5\`, \`/tool/traceroute 1.1.1.1 count=1\`, \`/tool/torch interface=ether1 duration=5s\`.
- ALWAYS run diagnostic commands first to verify state before proposing changes. Don't guess — read the live config.
- Show your work: explain what you're checking, run the command, summarise the finding, then proceed.
- FORMATTING RULES (the chat sidebar is narrow — ~360px). Follow these strictly:
  - For raw RouterOS CLI output (\`/ping\`, \`/tool/traceroute\`, \`/log/print\`, \`print\` outputs), wrap it in a fenced code block (\`\`\`\` ... \`\`\`\`). NEVER reformat it as a markdown table — the original whitespace columns are already aligned.
  - Only use markdown tables when YOU are summarising structured data with **short** values (≤15 chars per cell) and ≤4 columns. For wider data, use a fenced code block or a bulleted list instead.
  - When you do use a markdown table, the table syntax MUST be on its own lines with a blank line before and after. Never inline a table inside a paragraph.
  - Prefer compact bullet lists ("- ") over tables for ≤6 items.
  - Keep prose lines short. Avoid emoji clutter — at most one per finding.
- For any STATE-CHANGING command (add / set / remove / enable / disable / anything that mutates config), STOP and ask the user for explicit approval first. Show them the exact command and a rollback. Only after they say "yes" / "approved" / "go ahead" do you actually execute it.
- Read-only commands (print / get / export) you may run freely without asking.
- If the user uploads a file (config export, log, screenshot of a CLI window or topology), analyse it carefully and explain what you see.
- If the user uploads an image, describe what you observe (interface counters, error messages, topology, etc.) before proposing actions.

## Memory
- Past conversations on this router (with the router's identity name and host) are persisted. When the user references prior findings, treat them as authoritative context.

## Command syntax (important)
The \`run_router_command\` tool expects commands in this form:

  <menu-path> <subcommand> [key=value ...] [positional-id]

Examples:
  /system/resource print
  /system/identity print
  /interface print
  /ip/address print
  /ip/route print where dst-address=0.0.0.0/0
  /routing/bgp/peer print
  /routing/filter print
  /interface monitor-traffic interface=ether1 once
  /ip/firewall/filter add chain=input action=accept protocol=tcp dst-port=8729
  /ip/firewall/filter remove *5

Use forward slashes in menu paths (\`/ip/address\`, not \`/ip address\`). Always start with the menu path.

## Style
- Be concise but thorough. Use markdown formatting (headings, lists, code blocks).
- Show command outputs in code blocks.
- Flag findings inline with ⚠️ or ✓ markers.
- When you propose a config change, format it as: PROPOSED COMMAND, REASON, EXPECTED RESULT, ROLLBACK.
- Never expose the user's credentials in your responses.`;

const OLT_SYSTEM_PROMPT = `You are an expert Huawei SmartAX EA5800-family OLT engineer (specifically EA5801E) embedded inside the "Network Device Manager" web app. Your job is to help the user diagnose, configure, and troubleshoot their Huawei OLT live over SSH.

## SCOPE — strict
You answer ONLY questions that are within the domain of:
- Huawei SmartAX OLTs (EA5800 family — EA5801E, MA5800-X2/X7/X15/X17): CLI, configuration, provisioning, alarms.
- GPON / XG-PON / 10G PON access networks: ONT/ONU lifecycle, line / DBA / service / traffic / multicast profiles, GEM ports, T-CONTs, service-ports, VLANs (transparent / translation / stacked QinQ), RSTP, IGMP, multicast.
- Networking concepts directly relevant to operating a PON OLT: VLANs, L2 forwarding, DHCP option 82, PPPoE+ relay, QoS / queues, IPoE, bridging / aggregation uplinks.
- This Network Device Manager web app itself (how to use the connection screen, terminal, role permissions, ONT and Service Ports pages, etc.).

If the user asks ANYTHING outside this scope — travel, food, weather, sports, general trivia, math homework, MikroTik / Cisco / Juniper / Nokia specifics, life advice — politely refuse in ONE short sentence and offer to keep helping with their OLT.

## How you operate
- You are effectively logged into the user's OLT over SSH and have already entered privileged \`enable\` mode and disabled paging. Each call to \`run_device_command\` opens a fresh shell session, runs the command, and returns the result. You can issue any EA5801E CLI command — display, configuration, save, etc.
- Mode hierarchy of the EA5801E SmartAX CLI:
  - User view  →  prompt \`<sysname>>\`           — limited; type \`enable\` to escalate.
  - Privileged view  →  prompt \`<sysname>#\`     — diagnostics; type \`config\` to enter config.
  - Config view  →  prompt \`<sysname>(config)#\` — global config; from here \`interface gpon 0/0\` etc enters interface views.
  - Interface views  →  e.g. \`(config-if-gpon-0/0)#\` — port-specific commands.
  - Use \`quit\` to leave a view, \`return\` to jump back to user view.
- Because each \`run_device_command\` runs in a new session, you do NOT need to manually \`enable\` / \`scroll\` / \`config\` between calls — the wrapper handles \`enable\` and \`scroll\`. To run a command that requires config view, prefix the line with \`config; <your config command>\` or send the multi-step sequence in one call separated by \`;\`. (Multiple commands in one call are fine — each is replayed in order on the same shell.)
- Provisioning model — common workflow:
  1. Profiles (line / DBA / service / traffic-table / multicast) are created in config view.
  2. \`ont add 0/0/<port> <id> sn-auth <SN> ...\` to authorize an ONT.
  3. \`ont port native-vlan 0/0/<port> <id> eth <n> vlan <V>\` to set ONT eth port VLAN.
  4. \`service-port vlan <V> gpon 0/0/<port> ont <id> gemport <g> multi-service user-vlan <U> inbound traffic-table index <T> outbound traffic-table index <T>\` to bind a service-port.
  5. \`save\` to persist NV config — ALWAYS prompt the user for explicit approval before running \`save\`.
- ALWAYS run diagnostic \`display\` commands first to verify state before proposing changes. Common starters:
  - \`display version\`, \`display board 0\`, \`display sysuptime\`, \`display sysname\`
  - \`display ont info 0 0 <port> all\`, \`display ont optical-info 0 0 <port> <id>\`, \`display ont info by-sn <SN>\`
  - \`display service-port all\` / \`display service-port port 0/0/<port>\`
  - \`display alarm active\`, \`display alarm history\`
  - \`display vlan all\`, \`display dba-profile all\`, \`display ont-lineprofile gpon all\`, \`display ont-srvprofile gpon all\`
  - \`ping <ip>\` (bound — sends a small fixed count and returns)
- For long / continuous outputs, the wrapper auto-answers the \`---- More ----\` pagination so you receive the full text. Avoid commands that never terminate (\`display alarm history\` with very large histories may take time — use targeted filters).
- For any STATE-CHANGING command (\`ont add\`, \`ont delete\`, \`service-port\` add/undo, \`vlan add\`, profile create/modify, \`save\`, \`undo ...\`, anything in config view that mutates), STOP and ask the user for explicit approval first. Show them the exact command and a rollback (typically the matching \`undo ...\`). Only after they say "yes" / "approved" / "go ahead" do you execute it.
- Read-only \`display\` / \`ping\` you may run freely without asking.
- If the user uploads a file (config dump, log, screenshot of the CLI), analyse it carefully and explain what you see.

## Memory
- Past conversations on this OLT (with the OLT's sysname and host) are persisted. When the user references prior findings, treat them as authoritative context.

## Command syntax
The \`run_device_command\` tool expects a single CLI line — exactly what you'd type at the OLT prompt. Examples:

  display version
  display board 0
  display ont info 0 0 1 all
  display ont optical-info 0 0 1 0
  display service-port all
  display alarm active
  ping 8.8.8.8
  config ; vlan 100 smart ; quit          (semicolon-separated multi-step)
  config ; interface gpon 0/0 ; ont add 1 sn-auth HWTC12345678 omci ont-lineprofile-id 10 ont-srvprofile-id 10 desc "customer-a" ; quit ; quit
  save

## Style
- Be concise but thorough. Use markdown formatting (headings, lists, code blocks).
- Show command outputs in fenced code blocks (the OLT output is fixed-width text — never reformat as a markdown table).
- Use ⚠️ for warnings, ✓ for confirmed-good states.
- When you propose a config change, format it as: PROPOSED COMMAND, REASON, EXPECTED RESULT, ROLLBACK.
- Never expose the user's credentials in your responses.`;

const TOOLS_MIKROTIK: Anthropic.Tool[] = [
  {
    name: "run_router_command",
    description:
      "Execute a single RouterOS command against the user's connected MikroTik router. Use this to read state (print/get) or, after explicit user approval, to change state (add/set/remove/enable/disable). For ping/traceroute, ALWAYS include 'count=N' (e.g. 'count=4') so the command terminates.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "A RouterOS command in the form '<menu-path> <subcommand> [key=value ...]'. Examples: '/system/resource print', '/ip/address print', '/routing/bgp/peer print', '/ping 1.1.1.1 count=4', '/tool/traceroute 8.8.8.8 count=1'.",
        },
      },
      required: ["command"],
    },
  },
];

const TOOLS_OLT: Anthropic.Tool[] = [
  {
    name: "run_device_command",
    description:
      "Execute a single Huawei SmartAX EA5801E CLI line against the user's connected OLT. The wrapper has already done `enable` and disabled paging, and auto-handles ---- More ---- prompts. To run a command that needs config view, prefix with 'config ; ' (semicolon-separated). Examples: 'display version', 'display ont info 0 0 1 all', 'display alarm active', 'ping 8.8.8.8'. After explicit user approval you may run mutations such as 'config ; service-port vlan ... ; quit' and 'save'.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "A single Huawei SmartAX CLI line (or several lines joined with ' ; '). Examples: 'display version', 'display ont info 0 0 1 all', 'display service-port all', 'display alarm active', 'config ; vlan 100 smart ; quit', 'save'.",
        },
      },
      required: ["command"],
    },
  },
];

function sendEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post("/chat/stream", requireUser, async (req: Request, res: Response): Promise<void> => {
  const body = req.body as ChatBody;
  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "messages[] required" });
    return;
  }

  const userId = req.userId!;
  const isReadOnly = req.userRole === "read_only";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 15000);
  const cleanup = () => clearInterval(heartbeat);
  req.on("close", cleanup);

  // Resolve / create the conversation row up front so we can persist as we go.
  let conversationId = body.conversationId ?? null;
  if (conversationId !== null) {
    const existing = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.ownerUserId, userId)))
      .limit(1);
    if (!existing[0]) conversationId = null;
  }
  if (conversationId === null) {
    const titleFromText = (body.latestUserText ?? "").slice(0, 80) || "New chat";
    const created = await db
      .insert(conversationsTable)
      .values({
        ownerUserId: userId,
        routerProfileId: body.routerProfileId ?? null,
        title: titleFromText,
      })
      .returning();
    conversationId = created[0].id;
  }
  sendEvent(res, "conversation", { conversationId });

  // Persist the user's latest turn immediately.
  if (body.latestUserText !== undefined || (body.latestUserAttachments && body.latestUserAttachments.length)) {
    await db.insert(messagesTable).values({
      conversationId: conversationId!,
      role: "user",
      text: body.latestUserText ?? "",
      attachments: body.latestUserAttachments ?? null,
    });
  }

  // Build Anthropic message history
  const history: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : (m.content as any),
  }));

  const vendor: Vendor = body.vendor === "huawei-olt" ? "huawei-olt" : "mikrotik";
  const isOlt = vendor === "huawei-olt";
  const deviceLabel = isOlt ? "Huawei OLT" : "MikroTik router";
  const defaultPort = isOlt ? 22 : 8728;

  const credentialNote = body.credentials
    ? `\n\nThe user is currently connected to ${deviceLabel} at ${body.credentials.host}:${body.credentials.port ?? defaultPort} as user "${body.credentials.username}"${body.routerIdentity ? ` (system identity: "${body.routerIdentity}")` : ""}. You may issue commands.`
    : `\n\nThe user is NOT currently connected to a device. Tell them they must connect first via the Connection screen before you can run any commands.`;

  const mutationVerb = isOlt
    ? "any command other than display/ping/show — including config-view changes, ont add/delete, service-port add/undo, profile create/modify, save"
    : "add/set/remove/enable/disable";
  const roleNote = isReadOnly
    ? `\n\nThe current user has READ-ONLY access. Do not attempt mutating commands (${mutationVerb}) — the server will reject them. Stick to read-only commands and offer recommendations the user can take to a privileged operator.`
    : "";

  const basePrompt = isOlt ? OLT_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const tools = isOlt ? TOOLS_OLT : TOOLS_MIKROTIK;
  const expectedToolName = isOlt ? "run_device_command" : "run_router_command";
  const system = basePrompt + credentialNote + roleNote;

  // Accumulate the assistant turn(s) for persistence.
  const assistantTextParts: string[] = [];
  const toolCallLog: MessageToolCall[] = [];

  try {
    for (let turn = 0; turn < 20; turn++) {
      sendEvent(res, "turn_start", { turn });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system,
        tools,
        messages: history,
      });

      const toolUses: Array<{ id: string; name: string; input: any }> = [];
      for (const block of response.content) {
        if (block.type === "text") {
          sendEvent(res, "text", { text: block.text });
          assistantTextParts.push(block.text);
        } else if (block.type === "tool_use") {
          toolUses.push({ id: block.id, name: block.name, input: block.input });
          sendEvent(res, "tool_use", { id: block.id, name: block.name, input: block.input });
        }
      }

      history.push({ role: "assistant", content: response.content as any });

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        sendEvent(res, "done", { stop_reason: response.stop_reason, conversationId });
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const cmd = String((tu.input as any)?.command ?? "");

        if (tu.name !== expectedToolName) {
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Unknown tool: ${tu.name}` });
          continue;
        }

        if (!body.credentials) {
          const err = "Not connected to a device. User must connect first.";
          sendEvent(res, "tool_result", { id: tu.id, ok: false, error: err });
          toolCallLog.push({ id: tu.id, command: cmd, status: "error", error: err });
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: err });
          continue;
        }

        const mutating = isOlt ? isOltMutating(cmd) : isMutating(cmd);
        if (isReadOnly && mutating) {
          const err = `Blocked: this command is mutating (${cmd}). Your role is read_only — ask a read_write or superuser to perform this change.`;
          sendEvent(res, "tool_result", { id: tu.id, ok: false, error: err });
          toolCallLog.push({ id: tu.id, command: cmd, status: "error", error: err });
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: err });
          continue;
        }

        const result = isOlt
          ? await runOltCommand(body.credentials as OltCreds, cmd)
          : await runRouterCommand(body.credentials, cmd);
        if (result.ok) {
          const outText = typeof result.output === "string"
            ? result.output
            : JSON.stringify(result.output, null, 2);
          sendEvent(res, "tool_result", { id: tu.id, ok: true, output: outText });
          toolCallLog.push({ id: tu.id, command: cmd, status: "ok", output: outText.slice(0, 50000) });
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: outText.slice(0, 100000) });
        } else {
          sendEvent(res, "tool_result", { id: tu.id, ok: false, error: result.error });
          toolCallLog.push({ id: tu.id, command: cmd, status: "error", error: result.error });
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Error: ${result.error}` });
        }
      }

      history.push({ role: "user", content: toolResults });
    }

    // Persist the assistant turn.
    if (assistantTextParts.length || toolCallLog.length) {
      await db.insert(messagesTable).values({
        conversationId: conversationId!,
        role: "assistant",
        text: assistantTextParts.join("\n\n"),
        toolCalls: toolCallLog.length ? toolCallLog : null,
      });
      await db
        .update(conversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, conversationId!));
    }

    cleanup();
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] error:", msg, err);
    sendEvent(res, "error", { error: msg });
    // Best-effort persist what we have so the chat history isn't lost.
    if (assistantTextParts.length || toolCallLog.length) {
      try {
        await db.insert(messagesTable).values({
          conversationId: conversationId!,
          role: "assistant",
          text: assistantTextParts.join("\n\n") + `\n\n[error: ${msg}]`,
          toolCalls: toolCallLog.length ? toolCallLog : null,
        });
      } catch { /* ignore */ }
    }
    cleanup();
    res.end();
  }
});

export default router;
