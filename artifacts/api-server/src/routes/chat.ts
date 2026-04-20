import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, conversationsTable, messagesTable, type MessageAttachment, type MessageToolCall } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireUser } from "../middlewares/requireAuth";
import { connectRouter, type RouterCreds } from "../lib/router-transport";
import {
  tcpProbe, tcpPing, dnsLookup, reverseDns, httpProbe,
  asnLookup, rdapIp, rdapDomain, sandboxPublicInfo,
  type DnsRecordType,
} from "../lib/diagnostics";

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
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

type ChatBody = {
  messages: ChatMessage[];
  credentials?: Credentials;
  conversationId?: number;
  routerProfileId?: number;
  // Lightweight metadata about the latest user turn (for persistence — DB
  // does not need the full base64 image payload, only a description).
  latestUserAttachments?: MessageAttachment[];
  latestUserText?: string;
  routerIdentity?: string | null;
};

const SYSTEM_PROMPT = `You are an expert MikroTik / RouterOS network engineer and BGP operator embedded inside the "MikroTik Access" web app. Your job is to help the user diagnose, configure, and troubleshoot their MikroTik router live.

## How you operate
- The user has connected to a router via API-SSL / REST / SSH. You can issue RouterOS commands using the \`run_router_command\` tool. Each call opens a fresh session, runs the command, and returns the result.
- You ALSO have a suite of sandbox-side network probes that run from THIS server's vantage point on the public internet — independent of the user's router. These are invaluable for BGP/ISP work because they let you compare what the router sees vs what an arbitrary internet host sees:
  - \`tcp_probe\` — single TCP "telnet" connect with latency
  - \`tcp_ping\` — N TCP probes with min/avg/max/loss stats
  - \`dns_lookup\` — A/AAAA/MX/TXT/NS/CNAME/SOA/CAA records
  - \`reverse_dns\` — PTR for an IP
  - \`http_probe\` — HTTP/HTTPS reach test with status, latency, redirect chain, TLS cert info
  - \`asn_lookup\` — origin ASN and AS name for an IPv4 (Team Cymru)
  - \`rdap_ip\` / \`rdap_domain\` — modern WHOIS for an IP block or domain
  - \`sandbox_info\` — show this sandbox's public IP, ASN, and country (so you know where you're looking from)
- For network reachability problems, ALWAYS probe from BOTH vantage points (router with /ping or /tool/traceroute, sandbox with the tools above) and compare results.
- ALWAYS run diagnostic commands first to verify state before proposing changes. Don't guess — read the live config.
- Show your work: explain what you're checking, run the command, summarise the finding, then proceed.
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

const TOOLS: Anthropic.Tool[] = [
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
  {
    name: "tcp_probe",
    description: "From the sandbox vantage point, open a TCP connection to host:port with a timeout. Returns reachability and latency. Useful as 'telnet' replacement.",
    input_schema: {
      type: "object",
      properties: {
        host: { type: "string", description: "IP or hostname" },
        port: { type: "integer", description: "TCP port (1-65535)" },
        timeout_ms: { type: "integer", description: "Timeout in ms (default 5000)" },
      },
      required: ["host", "port"],
    },
  },
  {
    name: "tcp_ping",
    description: "From the sandbox vantage point, perform N TCP probes to host:port and return min/avg/max latency and loss percentage. Use as a substitute for ICMP ping.",
    input_schema: {
      type: "object",
      properties: {
        host: { type: "string" },
        port: { type: "integer" },
        count: { type: "integer", description: "Number of probes (default 4, max 10)" },
        timeout_ms: { type: "integer", description: "Per-probe timeout in ms (default 3000)" },
      },
      required: ["host", "port"],
    },
  },
  {
    name: "dns_lookup",
    description: "Resolve DNS records (A, AAAA, MX, TXT, NS, CNAME, SOA, CAA, SRV) for a hostname from the sandbox.",
    input_schema: {
      type: "object",
      properties: {
        host: { type: "string" },
        types: {
          type: "array",
          items: { type: "string", enum: ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "CAA", "SRV", "PTR"] },
          description: "Record types to query (default: ['A','AAAA'])",
        },
      },
      required: ["host"],
    },
  },
  {
    name: "reverse_dns",
    description: "Look up the PTR record (reverse DNS) for an IP address from the sandbox.",
    input_schema: {
      type: "object",
      properties: { ip: { type: "string" } },
      required: ["ip"],
    },
  },
  {
    name: "http_probe",
    description: "Make an HTTP/HTTPS request from the sandbox and return status, latency, headers, redirect chain, and TLS cert info if HTTPS. Use to verify whether a public endpoint is reachable from outside the user's network.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL including scheme" },
        method: { type: "string", enum: ["GET", "HEAD", "OPTIONS"], description: "HTTP method (default GET)" },
        follow_redirects: { type: "boolean", description: "Default true" },
        timeout_ms: { type: "integer", description: "Default 10000" },
        insecure_tls: { type: "boolean", description: "Skip cert validation (for self-signed). Default false." },
      },
      required: ["url"],
    },
  },
  {
    name: "asn_lookup",
    description: "Look up the origin ASN, prefix, country, and AS name for an IPv4 address using Team Cymru. Essential for BGP debugging — tells you which network actually announces a route.",
    input_schema: {
      type: "object",
      properties: { ip: { type: "string", description: "IPv4 address" } },
      required: ["ip"],
    },
  },
  {
    name: "rdap_ip",
    description: "Modern WHOIS lookup for an IP address via RDAP — returns allocation, organization, country, and contact info.",
    input_schema: {
      type: "object",
      properties: { ip: { type: "string" } },
      required: ["ip"],
    },
  },
  {
    name: "rdap_domain",
    description: "Modern WHOIS lookup for a domain name via RDAP — returns registrar, status, nameservers, dates.",
    input_schema: {
      type: "object",
      properties: { domain: { type: "string" } },
      required: ["domain"],
    },
  },
  {
    name: "sandbox_info",
    description: "Show this sandbox's public IP, ASN, and country — so you know what vantage point your sandbox-side probes are coming from.",
    input_schema: { type: "object", properties: {} },
  },
];

// Dispatch a sandbox-side diagnostic tool. Returns formatted text output.
async function runDiagnosticTool(
  name: string,
  input: Record<string, unknown>,
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  try {
    switch (name) {
      case "tcp_probe": {
        const r = await tcpProbe(
          String(input.host),
          Number(input.port),
          input.timeout_ms !== undefined ? Number(input.timeout_ms) : undefined,
        );
        return { ok: true, output: r };
      }
      case "tcp_ping": {
        const count = Math.min(Math.max(Number(input.count ?? 4), 1), 10);
        const r = await tcpPing(
          String(input.host),
          Number(input.port),
          count,
          input.timeout_ms !== undefined ? Number(input.timeout_ms) : undefined,
        );
        return { ok: true, output: r };
      }
      case "dns_lookup": {
        const types = (input.types as DnsRecordType[] | undefined) ?? ["A", "AAAA"];
        const r = await dnsLookup(String(input.host), types);
        return { ok: true, output: r };
      }
      case "reverse_dns": {
        const r = await reverseDns(String(input.ip));
        return { ok: true, output: { ip: input.ip, hostnames: r } };
      }
      case "http_probe": {
        const r = await httpProbe(String(input.url), {
          method: input.method as string | undefined,
          followRedirects: input.follow_redirects as boolean | undefined,
          timeoutMs: input.timeout_ms as number | undefined,
          insecureTls: input.insecure_tls as boolean | undefined,
        });
        return { ok: true, output: r };
      }
      case "asn_lookup": {
        const r = await asnLookup(String(input.ip));
        return { ok: true, output: r };
      }
      case "rdap_ip": {
        const r = await rdapIp(String(input.ip));
        return { ok: true, output: r };
      }
      case "rdap_domain": {
        const r = await rdapDomain(String(input.domain));
        return { ok: true, output: r };
      }
      case "sandbox_info": {
        const r = await sandboxPublicInfo();
        return { ok: true, output: r };
      }
      default:
        return { ok: false, error: `Unknown diagnostic tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const DIAGNOSTIC_TOOLS = new Set([
  "tcp_probe", "tcp_ping", "dns_lookup", "reverse_dns",
  "http_probe", "asn_lookup", "rdap_ip", "rdap_domain", "sandbox_info",
]);

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

  const credentialNote = body.credentials
    ? `\n\nThe user is currently connected to MikroTik router at ${body.credentials.host}:${body.credentials.port ?? 8728} as user "${body.credentials.username}"${body.routerIdentity ? ` (system identity: "${body.routerIdentity}")` : ""}. You may issue commands.`
    : `\n\nThe user is NOT currently connected to a router. Tell them they must connect first via the Connection screen before you can run any commands.`;

  const roleNote = isReadOnly
    ? `\n\nThe current user has READ-ONLY access. Do not attempt mutating commands (add/set/remove/enable/disable) — the server will reject them. Stick to print/get/export and offer recommendations the user can take to a privileged operator.`
    : "";

  const system = SYSTEM_PROMPT + credentialNote + roleNote;

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
        tools: TOOLS,
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
        // Sandbox-side diagnostic tools — no router required, no auth gating beyond requireUser.
        if (DIAGNOSTIC_TOOLS.has(tu.name)) {
          const inputObj = (tu.input as Record<string, unknown>) ?? {};
          const label = `${tu.name}(${JSON.stringify(inputObj).slice(0, 120)})`;
          const result = await runDiagnosticTool(tu.name, inputObj);
          if (result.ok) {
            const outText = typeof result.output === "string"
              ? result.output
              : JSON.stringify(result.output, null, 2);
            sendEvent(res, "tool_result", { id: tu.id, ok: true, output: outText });
            toolCallLog.push({ id: tu.id, command: label, status: "ok", output: outText.slice(0, 50000) });
            toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: outText.slice(0, 100000) });
          } else {
            sendEvent(res, "tool_result", { id: tu.id, ok: false, error: result.error });
            toolCallLog.push({ id: tu.id, command: label, status: "error", error: result.error });
            toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Error: ${result.error}` });
          }
          continue;
        }

        if (tu.name !== "run_router_command") {
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Unknown tool: ${tu.name}` });
          continue;
        }

        const cmd = String((tu.input as any)?.command ?? "");

        if (!body.credentials) {
          const err = "Not connected to a router. User must connect first.";
          sendEvent(res, "tool_result", { id: tu.id, ok: false, error: err });
          toolCallLog.push({ id: tu.id, command: cmd, status: "error", error: err });
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: err });
          continue;
        }

        if (isReadOnly && isMutating(cmd)) {
          const err = `Blocked: this command is mutating (${cmd}). Your role is read_only — ask a read_write or superuser to perform this change.`;
          sendEvent(res, "tool_result", { id: tu.id, ok: false, error: err });
          toolCallLog.push({ id: tu.id, command: cmd, status: "error", error: err });
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: err });
          continue;
        }

        const result = await runRouterCommand(body.credentials, cmd);
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
