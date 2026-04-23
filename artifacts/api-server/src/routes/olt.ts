/**
 * Huawei SmartAX EA5801E (and related EA5800-family) OLT API routes.
 * SSH-only. Each endpoint opens a single shell session, runs one or more
 * `display ...` commands, and returns either parsed structured data or the
 * raw text for the terminal-style pages.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { requireUser, requireWriter } from "../middlewares/requireAuth";
import {
  withOlt,
  probeOltIdentity,
  type OltSession,
  type OltCreds,
} from "../lib/huawei-olt";

const router: IRouter = Router();
router.use(requireUser);

const Creds = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().optional(),
  username: z.string().min(1),
  password: z.string(),
});

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    console.error("[olt] Error:", err.message);
    return err.message;
  }
  const s = String(err);
  console.error("[olt] Error:", s);
  return s;
}

function parseCreds(req: Request, res: Response): OltCreds | null {
  const parsed = Creds.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return null;
  }
  return parsed.data;
}

// ─────────────────────────── CONNECT ───────────────────────────

router.post("/olt/connect", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const probe = await withOlt(creds, async (s) => probeOltIdentity(s));
    res.json({
      success: true,
      message: "Connected successfully",
      identity: probe.identity,
      // Reuse routerOs / routerBoard columns as generic version / hardware fields.
      routerOs: probe.softwareVersion,
      routerBoard: probe.hardware,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

// ─────────────────────────── DASHBOARD ───────────────────────────

interface OltDashboard {
  version: string;
  board: string;
  uptime: string | null;
  alarmCount: number | null;
  identity: string | null;
}

router.post("/olt/dashboard", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const data = await withOlt<OltDashboard>(creds, async (s) => {
      const [version, board, uptimeOut, alarms, sysname] = await Promise.all([
        safeExec(s, "display version"),
        safeExec(s, "display board 0"),
        safeExec(s, "display sysuptime"),
        safeExec(s, "display alarm active"),
        safeExec(s, "display sysname"),
      ]);
      const upMatch = uptimeOut.match(/uptime[^:]*:\s*([^\r\n]+)/i)
        || uptimeOut.match(/up\s+for\s+([^\r\n]+)/i);
      const sysMatch = sysname.match(/(?:Sysname[^:]*:\s*)?([A-Za-z0-9_\-.]+)/);
      // Count alarm rows — header lines contain "----" or "Total"
      const alarmRows = alarms
        .split("\n")
        .filter((l) => /^\s*\d+\s+/.test(l));
      return {
        version: version.trim(),
        board: board.trim(),
        uptime: upMatch ? upMatch[1].trim() : null,
        alarmCount: alarmRows.length,
        identity: sysMatch ? sysMatch[1] : null,
      };
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// ─────────────────────────── ONTs ───────────────────────────

interface OntRow {
  port: string;            // "0/0/1"
  index: string;           // ONT id
  sn: string | null;
  runState: string | null;
  configState: string | null;
  matchState: string | null;
  description: string | null;
  lastDownCause: string | null;
}

/**
 * Parse `display ont info 0 0 X all` output. Falls back to a permissive
 * column-split scheme — the SmartAX text format varies slightly between
 * firmware revisions but always contains lines starting with "  N  N  N ".
 */
function parseOntInfoBlock(text: string, port: string): OntRow[] {
  const out: OntRow[] = [];
  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    // Match lines like:
    //   "  0/0/1  0  HWTC12345678  online   active   match"
    const m = line.match(
      /^\s*(\d+\/\d+\/\d+)\s+(\d+)\s+([A-Z0-9]{4,32})\s+(\S+)\s+(\S+)?\s*(\S+)?\s*$/i,
    );
    if (m) {
      out.push({
        port,
        index: m[2],
        sn: m[3] ?? null,
        runState: m[4] ?? null,
        configState: m[5] ?? null,
        matchState: m[6] ?? null,
        description: null,
        lastDownCause: null,
      });
    }
  }
  return out;
}

/** Discover all GPON port slots from `display board 0` output. */
function parseGponPorts(boardText: string): string[] {
  // EA5801E typically has GPON ports on slot 0; we enumerate ONT search
  // across the standard 0/0/0 .. 0/0/15 range. If the board parse turns up
  // explicit GPON ports we use those, otherwise fall back to a small range.
  const ports = new Set<string>();
  for (const line of boardText.split("\n")) {
    const m = line.match(/\b(0\/\d+\/\d+)\b/);
    if (m) ports.add(m[1]);
  }
  if (ports.size > 0) return [...ports];
  // Fallback: scan first 8 GPON ports on slot 0/0.
  return Array.from({ length: 8 }, (_, i) => `0/0/${i}`);
}

router.post("/olt/onts", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const onts = await withOlt<OntRow[]>(creds, async (s) => {
      const board = await safeExec(s, "display board 0");
      const ports = parseGponPorts(board);
      const all: OntRow[] = [];
      for (const p of ports) {
        const [, frame, slot, port] = p.match(/^(\d+)\/(\d+)\/(\d+)$/) ?? [];
        if (frame == null) continue;
        // "display ont info 0 0 X all" — list every ONT on that GPON port
        const out = await safeExec(
          s,
          `display ont info ${frame} ${slot} ${port} all`,
        );
        all.push(...parseOntInfoBlock(out, p));
      }
      return all;
    });
    res.json({ onts });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

const OpticalBody = Creds.extend({
  port: z.string().regex(/^\d+\/\d+\/\d+$/),
  ontIndex: z.coerce.number().int().nonnegative(),
});

router.post("/olt/ont/optical", async (req, res): Promise<void> => {
  const parsed = OpticalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password, port: ontPort, ontIndex } = parsed.data as any;
  const [, f, s, p] = ontPort.match(/^(\d+)\/(\d+)\/(\d+)$/);
  try {
    const text = await withOlt({ host, port, username, password }, async (sess) => {
      return await safeExec(
        sess,
        `display ont optical-info ${f} ${s} ${p} ${ontIndex}`,
      );
    });
    res.json({ output: text });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// ─────────────────────────── SERVICE PORTS ───────────────────────────

interface ServicePortRow {
  index: string;
  vlan: string | null;
  port: string | null;     // "0/0/1"
  ontIndex: string | null;
  gemport: string | null;
  uservlan: string | null;
  state: string | null;
}

function parseServicePorts(text: string): ServicePortRow[] {
  const out: ServicePortRow[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    // Generic match: "<idx> <vlan> <gponN/N/N> <ontid> <gemport> <uservlan> ..."
    const m = line.match(
      /^\s*(\d+)\s+(\d+)\s+\S*\s*(\d+\/\d+\/\d+)\s+(\d+)\s+(\d+)\s+(\d+|other|untag|trans-?\S*)\s+/i,
    );
    if (m) {
      out.push({
        index: m[1],
        vlan: m[2],
        port: m[3],
        ontIndex: m[4],
        gemport: m[5],
        uservlan: m[6],
        state: null,
      });
      continue;
    }
    // Simpler match: "  <idx>  <vlan>  ... up/down"
    const m2 = line.match(/^\s*(\d+)\s+(\d+)\s+(.*?)\s+(up|down|active|inactive)\s*$/i);
    if (m2) {
      out.push({
        index: m2[1],
        vlan: m2[2],
        port: null,
        ontIndex: null,
        gemport: null,
        uservlan: null,
        state: m2[4],
      });
    }
  }
  return out;
}

router.post("/olt/service-ports", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const result = await withOlt(creds, async (s) => {
      const text = await safeExec(s, "display service-port all");
      return { rows: parseServicePorts(text), raw: text };
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

const AddSpBody = Creds.extend({
  vlan: z.coerce.number().int().min(1).max(4094),
  port: z.string().regex(/^\d+\/\d+\/\d+$/),
  ontIndex: z.coerce.number().int().nonnegative(),
  gemport: z.coerce.number().int().nonnegative(),
  uservlan: z.coerce.number().int().min(1).max(4094),
  trafficTable: z.coerce.number().int().nonnegative().default(6),
});

router.post("/olt/service-port/add", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = AddSpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const out = await withOlt(
      { host: d.host, port: d.port as any, username: d.username, password: d.password },
      async (s) => {
        await s.exec("config");
        const cmd =
          `service-port vlan ${d.vlan} gpon ${d.port} ont ${d.ontIndex} ` +
          `gemport ${d.gemport} multi-service user-vlan ${d.uservlan} ` +
          `inbound traffic-table index ${d.trafficTable} ` +
          `outbound traffic-table index ${d.trafficTable}`;
        const r = await s.exec(cmd);
        await s.exec("quit");
        return r;
      },
    );
    res.json({ output: out, success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

const DelSpBody = Creds.extend({
  index: z.coerce.number().int().nonnegative(),
});

router.post("/olt/service-port/delete", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = DelSpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const out = await withOlt(
      { host: d.host, port: d.port as any, username: d.username, password: d.password },
      async (s) => {
        await s.exec("config");
        const r = await s.exec(`undo service-port ${d.index}`);
        await s.exec("quit");
        return r;
      },
    );
    res.json({ output: out, success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

// ─────────────────────────── ALARMS ───────────────────────────

interface AlarmRow {
  id: string;
  severity: string | null;
  occurredAt: string | null;
  description: string;
}

function parseAlarms(text: string): AlarmRow[] {
  const out: AlarmRow[] = [];
  const lines = text.split("\n");
  let cur: AlarmRow | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    // Header: "  AlarmID    : 0x40000003"
    const idM = line.match(/AlarmID\s*[:=]\s*(\S+)/i);
    if (idM) {
      if (cur) out.push(cur);
      cur = { id: idM[1], severity: null, occurredAt: null, description: "" };
      continue;
    }
    if (!cur) continue;
    const sevM = line.match(/(?:Alarm\s+level|Severity)\s*[:=]\s*(\S+)/i);
    if (sevM) cur.severity = sevM[1];
    const tM = line.match(/(?:Occur\s+time|Time)\s*[:=]\s*(.+)$/i);
    if (tM) cur.occurredAt = tM[1].trim();
    const dM = line.match(/(?:Description|Reason)\s*[:=]\s*(.+)$/i);
    if (dM) cur.description = dM[1].trim();
  }
  if (cur) out.push(cur);

  // Fallback row format: "  1  <severity>  <date> <time>  <desc>"
  if (out.length === 0) {
    for (const raw of lines) {
      const m = raw.match(/^\s*(\d+)\s+(critical|major|minor|warning)\s+(\S+\s+\S+)\s+(.*)$/i);
      if (m) {
        out.push({
          id: m[1],
          severity: m[2],
          occurredAt: m[3],
          description: m[4].trim(),
        });
      }
    }
  }
  return out;
}

router.post("/olt/alarms", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const data = await withOlt(creds, async (s) => {
      const text = await safeExec(s, "display alarm active");
      return { alarms: parseAlarms(text), raw: text };
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// ─────────────────────────── COMMAND (terminal) ───────────────────────────

const CommandBody = Creds.extend({
  command: z.string().min(1).max(2000),
});

router.post("/olt/command", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = CommandBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const output = await withOlt(
      { host: d.host, port: d.port as any, username: d.username, password: d.password },
      async (s) => s.exec(d.command),
    );
    res.json({ output: output || "(no output)", success: true });
  } catch (err) {
    res.json({ output: `Error: ${errMsg(err)}`, success: false });
  }
});

// ─────────────────────────── helpers ───────────────────────────

async function safeExec(s: OltSession, cmd: string): Promise<string> {
  try {
    return await s.exec(cmd);
  } catch (e) {
    return `(error running "${cmd}": ${e instanceof Error ? e.message : String(e)})`;
  }
}

export default router;
