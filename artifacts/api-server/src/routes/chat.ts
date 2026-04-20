import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { RouterOSClient } from "routeros-client";

const router: IRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL!,
});

const API_SSL_PORTS = [8729];

type Credentials = {
  host: string;
  port?: number;
  username: string;
  password: string;
};

function makeClient(c: Credentials) {
  const portNum = c.port ?? 8728;
  const useTls = API_SSL_PORTS.includes(portNum);
  return new RouterOSClient({
    host: c.host,
    user: c.username,
    password: c.password,
    port: portNum,
    tls: useTls
      ? { rejectUnauthorized: false, ciphers: "ADH:@SECLEVEL=0" }
      : undefined,
    timeout: 15,
  });
}

// Run a single RouterOS command on a fresh connection. Returns either
// the structured rows for a `print` query, or a plain string for actions.
async function runRouterCommand(
  c: Credentials,
  command: string,
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  const api = makeClient(c);
  let client: Awaited<ReturnType<RouterOSClient["connect"]>>;
  try {
    client = await api.connect();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    const trimmed = command.trim();
    // Parse: "<menu-path> <subcommand?> <args...>"
    // e.g. "/system/resource print", "/ip/address add address=1.2.3.4/24 interface=ether1"
    const parts = trimmed.split(/\s+/);
    let menuPath = parts[0];
    if (!menuPath.startsWith("/")) menuPath = "/" + menuPath;
    const sub = (parts[1] ?? "print").toLowerCase();
    const argTokens = parts.slice(2);

    // Parse key=value tokens (values may be quoted)
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
        const rows = await menu.get();
        output = rows;
        break;
      }
      case "add": {
        const r = await (menu as any).add(args);
        output = `Added: ${JSON.stringify(r)}`;
        break;
      }
      case "set": {
        if (positional) await (menu as any).set(args, positional);
        else await (menu as any).set(args);
        output = "Set successfully.";
        break;
      }
      case "remove": {
        if (!positional) throw new Error("remove requires an id/index argument");
        await (menu as any).remove(positional);
        output = `Removed ${positional}.`;
        break;
      }
      case "enable": {
        if (!positional) throw new Error("enable requires an id/index argument");
        await (menu as any).enable(positional);
        output = `Enabled ${positional}.`;
        break;
      }
      case "disable": {
        if (!positional) throw new Error("disable requires an id/index argument");
        await (menu as any).disable(positional);
        output = `Disabled ${positional}.`;
        break;
      }
      default: {
        // Try as a generic print
        try {
          output = await menu.get();
        } catch {
          output = `Subcommand "${sub}" not supported. Use: print|get|add|set|remove|enable|disable`;
        }
      }
    }
    api.close();
    return { ok: true, output };
  } catch (err) {
    api.close();
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
};

const SYSTEM_PROMPT = `You are an expert MikroTik / RouterOS network engineer and BGP operator embedded inside the "MikroTik Access" web app. Your job is to help the user diagnose, configure, and troubleshoot their MikroTik router live.

## How you operate
- The user has connected to a router via API-SSL. You can issue RouterOS commands using the \`run_router_command\` tool. Each call opens a fresh API-SSL session, runs the command, and returns the result.
- ALWAYS run diagnostic commands first to verify state before proposing changes. Don't guess — read the live config.
- Show your work: explain what you're checking, run the command, summarise the finding, then proceed.
- For any STATE-CHANGING command (add / set / remove / enable / disable / anything that mutates config), STOP and ask the user for explicit approval first. Show them the exact command and a rollback. Only after they say "yes" / "approved" / "go ahead" do you actually execute it.
- Read-only commands (print / get / export) you may run freely without asking.
- If the user uploads a file (config export, log, screenshot of a CLI window or topology), analyse it carefully and explain what you see.
- If the user uploads an image, describe what you observe (interface counters, error messages, topology, etc.) before proposing actions.

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
      "Execute a single RouterOS command against the user's connected MikroTik router via API-SSL. Use this to read state (print/get) or, after explicit user approval, to change state (add/set/remove/enable/disable).",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "A RouterOS command in the form '<menu-path> <subcommand> [key=value ...]'. Examples: '/system/resource print', '/ip/address print', '/routing/bgp/peer print'.",
        },
      },
      required: ["command"],
    },
  },
];

function sendEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post("/chat/stream", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as ChatBody;
  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "messages[] required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Heartbeat to keep proxies from closing the connection
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 15000);

  const cleanup = () => clearInterval(heartbeat);
  req.on("close", cleanup);

  // Build Anthropic message history
  const history: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string"
      ? m.content
      : (m.content as any),
  }));

  const credentialNote = body.credentials
    ? `\n\nThe user is currently connected to MikroTik router at ${body.credentials.host}:${body.credentials.port ?? 8728} as user "${body.credentials.username}". You may issue commands.`
    : `\n\nThe user is NOT currently connected to a router. Tell them they must connect first via the Connection screen before you can run any commands.`;

  const system = SYSTEM_PROMPT + credentialNote;

  try {
    // Multi-turn agentic loop: keep calling Claude until it stops requesting tools
    for (let turn = 0; turn < 20; turn++) {
      sendEvent(res, "turn_start", { turn });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system,
        tools: TOOLS,
        messages: history,
      });

      // Emit text blocks as they appear in this response
      const toolUses: Array<{ id: string; name: string; input: any }> = [];
      for (const block of response.content) {
        if (block.type === "text") {
          sendEvent(res, "text", { text: block.text });
        } else if (block.type === "tool_use") {
          toolUses.push({ id: block.id, name: block.name, input: block.input });
          sendEvent(res, "tool_use", {
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      // Add assistant turn to history
      history.push({ role: "assistant", content: response.content as any });

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        // Conversation complete
        sendEvent(res, "done", { stop_reason: response.stop_reason });
        break;
      }

      // Execute every tool the model called, then feed results back
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        if (tu.name !== "run_router_command") {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            is_error: true,
            content: `Unknown tool: ${tu.name}`,
          });
          continue;
        }

        if (!body.credentials) {
          const err = "Not connected to a router. User must connect first.";
          sendEvent(res, "tool_result", { id: tu.id, ok: false, error: err });
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            is_error: true,
            content: err,
          });
          continue;
        }

        const cmd = String((tu.input as any)?.command ?? "");
        const result = await runRouterCommand(body.credentials, cmd);
        if (result.ok) {
          const outText = typeof result.output === "string"
            ? result.output
            : JSON.stringify(result.output, null, 2);
          sendEvent(res, "tool_result", { id: tu.id, ok: true, output: outText });
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: outText.slice(0, 100000), // hard cap
          });
        } else {
          sendEvent(res, "tool_result", { id: tu.id, ok: false, error: result.error });
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            is_error: true,
            content: `Error: ${result.error}`,
          });
        }
      }

      history.push({ role: "user", content: toolResults });
    }

    cleanup();
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] error:", msg, err);
    sendEvent(res, "error", { error: msg });
    cleanup();
    res.end();
  }
});

export default router;
