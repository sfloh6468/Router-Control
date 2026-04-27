/**
 * Huawei SmartAX EA5801E (and related EA5800-family) OLT API routes.
 * SSH-only. Each endpoint opens a single shell session, runs one or more
 * `display ...` commands, and returns either parsed structured data or the
 * raw text for the terminal-style pages.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, ilike, desc, sql } from "drizzle-orm";
import { db, pool, oltLoginEventsTable, type PoolClient } from "@workspace/db";
import QueryStream from "pg-query-stream";
import { once } from "node:events";
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

interface GponPortSummary {
  port: string;       // "0/0/0"
  state: string | null;
}

interface OltDashboard {
  version: string;
  board: string;
  uptime: string | null;
  alarmCount: number | null;
  identity: string | null;
  gponPorts: GponPortSummary[];
}

/** Parse `display port state 0` (or `display port info gpon`) into per-port rows. */
function parseGponPortStates(text: string): GponPortSummary[] {
  const out: GponPortSummary[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    // "  0   online" / "  0/0/0   active   ..." — look for a port column
    // first then a state token (online/offline/active/inactive/up/down).
    const m = line.match(
      /^\s*(\d+(?:\/\d+\/\d+)?)\s+(online|offline|active|inactive|up|down|abnormal)\b/i,
    );
    if (m) {
      const id = m[1].includes("/") ? m[1] : `0/0/${m[1]}`;
      out.push({ port: id, state: m[2] });
    }
  }
  return out;
}

router.post("/olt/dashboard", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const data = await withOlt<OltDashboard>(creds, async (s) => {
      const [version, board, uptimeOut, alarms, sysname, portState] = await Promise.all([
        safeExec(s, "display version"),
        safeExec(s, "display board 0"),
        safeExec(s, "display sysuptime"),
        safeExec(s, "display alarm active"),
        safeExec(s, "display sysname"),
        safeExec(s, "display port state 0"),
      ]);
      const upMatch = uptimeOut.match(/uptime[^:]*:\s*([^\r\n]+)/i)
        || uptimeOut.match(/up\s+for\s+([^\r\n]+)/i);
      const sysMatch = sysname.match(/(?:Sysname[^:]*:\s*)?([A-Za-z0-9_\-.]+)/);
      const alarmRows = alarms
        .split("\n")
        .filter((l) => /^\s*\d+\s+/.test(l));
      let gponPorts = parseGponPortStates(portState);
      // Fallback: if `display port state 0` wasn't accepted, derive from board.
      if (gponPorts.length === 0) {
        const ports = parseGponPorts(board);
        gponPorts = ports.map((p) => ({ port: p, state: null }));
      }
      return {
        version: version.trim(),
        board: board.trim(),
        uptime: upMatch ? upMatch[1].trim() : null,
        alarmCount: alarmRows.length,
        identity: sysMatch ? sysMatch[1] : null,
        gponPorts,
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
 * Parse `display ont info 0 0 X all` output. The EA5800 family emits this
 * table in two different shapes depending on firmware:
 *
 *   (A) "wide" form, port prefix on each row:
 *       "  0/0/1   0   HWTC12345678   online   active   match"
 *
 *   (B) "scoped" form (command was issued for a specific port, so the
 *       port column is omitted):
 *       "  0   HWTC12345678   active     online   normal   match"
 *
 * We try (A) first, then fall back to (B). Header lines and "Total" /
 * "----" separators are skipped.
 */
function parseOntInfoBlock(text: string, port: string): OntRow[] {
  const out: OntRow[] = [];
  const seen = new Set<string>();
  const push = (r: OntRow) => {
    const key = `${r.index}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(r);
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line || /^[-\s]*$/.test(line)) continue;
    if (/^\s*(F\/S\/P|ONT[-\s]?ID|SN|Description|Run\s+state|Config\s+state)/i.test(line)) {
      continue; // header
    }

    // (A) wide form
    const wide = line.match(
      /^\s*(\d+\/\d+\/\d+)\s+(\d+)\s+([A-Z0-9]{4,32})\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?\s*$/i,
    );
    if (wide) {
      push({
        port,
        index: wide[2],
        sn: wide[3] ?? null,
        runState: wide[4] ?? null,
        configState: wide[5] ?? null,
        matchState: wide[6] ?? null,
        description: null,
        lastDownCause: null,
      });
      continue;
    }

    // (B) scoped form — first column is ONT-ID, second is SN, then the
    // status columns. SN may be absent on some firmware (uncommon).
    const scoped = line.match(
      /^\s*(\d{1,4})\s+([A-Z0-9]{4,32})\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?(?:\s+(\S+))?\s*$/i,
    );
    if (scoped) {
      // The column layout for (B) is typically:
      //   ONT-ID  SN  CONTROL  RUN  CONFIG  MATCH
      // We map the most useful three (run/config/match) preferring the
      // tokens after CONTROL when six columns are present.
      const idx = scoped[1];
      const sn = scoped[2];
      const cols = [scoped[3], scoped[4], scoped[5], scoped[6]].filter(Boolean) as string[];
      let runState: string | null = null;
      let configState: string | null = null;
      let matchState: string | null = null;
      if (cols.length >= 4) {
        // CONTROL RUN CONFIG MATCH
        [, runState, configState, matchState] = cols;
      } else {
        [runState, configState, matchState] = [
          cols[0] ?? null,
          cols[1] ?? null,
          cols[2] ?? null,
        ];
      }
      push({
        port,
        index: idx,
        sn,
        runState,
        configState,
        matchState,
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
        const rows = parseOntInfoBlock(out, p);
        // Per-ONT detail call to surface "last down cause" — EA5800 only
        // includes that field in the per-ONT detail view.
        for (const row of rows) {
          const detail = await safeExec(
            s,
            `display ont info ${frame} ${slot} ${port} ${row.index}`,
          );
          const lc = detail.match(/Last\s+down\s+cause\s*[:=]\s*([^\r\n]+)/i);
          if (lc) row.lastDownCause = lc[1].trim();
          const desc = detail.match(/Description\s*[:=]\s*([^\r\n]+)/i);
          if (desc) row.description = desc[1].trim();
        }
        all.push(...rows);
      }
      return all;
    });
    res.json({ onts });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

const OpticalBody = Creds.extend({
  ontPort: z.string().regex(/^\d+\/\d+\/\d+$/),
  ontIndex: z.coerce.number().int().nonnegative(),
});

interface OpticalInfo {
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  voltageV: number | null;
  temperatureC: number | null;
  biasMa: number | null;
}

/** Parse `display ont optical-info` into structured Rx/Tx/Voltage/Temp/Bias. */
function parseOpticalInfo(text: string): OpticalInfo {
  const num = (re: RegExp): number | null => {
    const m = text.match(re);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  return {
    rxPowerDbm: num(/(?:RX|Rx)[\s-]*(?:optical\s+)?power[^:=]*[:=]\s*(-?\d+(?:\.\d+)?)/i),
    txPowerDbm: num(/(?:TX|Tx)[\s-]*(?:optical\s+)?power[^:=]*[:=]\s*(-?\d+(?:\.\d+)?)/i),
    voltageV: num(/(?:Supply\s+)?(?:Voltage)[^:=]*[:=]\s*(-?\d+(?:\.\d+)?)/i),
    temperatureC: num(/Temperature[^:=]*[:=]\s*(-?\d+(?:\.\d+)?)/i),
    biasMa: num(/(?:Laser\s+)?bias\s+current[^:=]*[:=]\s*(-?\d+(?:\.\d+)?)/i),
  };
}

router.post("/olt/ont/optical", async (req, res): Promise<void> => {
  // Accept legacy `port` in addition to `ontPort` so the credentials' "port"
  // field doesn't collide with the GPON port id.
  const body = { ...req.body, ontPort: req.body?.ontPort ?? req.body?.gponPort };
  const parsed = OpticalBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const m = d.ontPort.match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (!m) { res.status(400).json({ error: "Invalid ontPort format" }); return; }
  const [, f, s, p] = m;
  try {
    const text = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (sess) => safeExec(
        sess,
        `display ont optical-info ${f} ${s} ${p} ${d.ontIndex}`,
      ),
    );
    res.json({ output: text, ...parseOpticalInfo(text) });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// ─────────────────────────── ONT ACTIONS (provisioning) ───────────────────────────

const OntActionBody = Creds.extend({
  ontPort: z.string().regex(/^\d+\/\d+\/\d+$/),
  ontIndex: z.coerce.number().int().nonnegative(),
  action: z.enum(["activate", "deactivate", "delete"]),
});

router.post("/olt/ont/action", ...requireWriter(), async (req, res): Promise<void> => {
  const body = { ...req.body, ontPort: req.body?.ontPort ?? req.body?.gponPort };
  const parsed = OntActionBody.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const m = d.ontPort.match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (!m) { res.status(400).json({ error: "Invalid ontPort format" }); return; }
  const [, f, sl, p] = m;
  // EA5800 family: ONT lifecycle commands run inside the GPON interface mode.
  const verb =
    d.action === "activate" ? "ont activate" :
    d.action === "deactivate" ? "ont deactivate" :
    "ont delete";
  try {
    const out = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (sess) => {
        await sess.exec("config");
        await sess.exec(`interface gpon ${f}/${sl}`);
        const r = await sess.exec(`${verb} ${p} ${d.ontIndex}`);
        await sess.exec("quit");
        await sess.exec("quit");
        return r;
      },
    );
    res.json({ output: out, success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
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
  inboundTt: string | null;   // inbound traffic-table index
  outboundTt: string | null;  // outbound traffic-table index
  state: string | null;
}

function parseServicePorts(text: string): ServicePortRow[] {
  const out: ServicePortRow[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line || /^[-\s]*$/.test(line)) continue;
    // Skip header rows.
    if (/^\s*INDEX/i.test(line) || /^\s*VLAN\s+/i.test(line)) continue;

    // Wide layout used by EA5800 `display service-port all`:
    // "  N  vlan  ATTR  GPON 0/0/N  ontIdx  gemport  uservlan  ...  in_tt  out_tt  state"
    const wide = line.match(
      /^\s*(\d+)\s+(\d+)\s+\S*\s*(\d+\/\d+\/\d+)\s+(\d+)\s+(\d+)\s+(\d+|other|untag|trans-?\S*)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(up|down|active|inactive|deactive)?\s*$/i,
    );
    if (wide) {
      out.push({
        index: wide[1],
        vlan: wide[2],
        port: wide[3],
        ontIndex: wide[4],
        gemport: wide[5],
        uservlan: wide[6],
        inboundTt: wide[9] ?? null,
        outboundTt: wide[10] ?? null,
        state: wide[11] ?? null,
      });
      continue;
    }

    // Narrower fallback that still captures the front columns and tries to
    // pull the last two numeric columns as the inbound/outbound traffic
    // table indices, tolerating extra/missing middle columns.
    const front = line.match(
      /^\s*(\d+)\s+(\d+)\s+\S*\s*(\d+\/\d+\/\d+)\s+(\d+)\s+(\d+)\s+(\d+|other|untag|trans-?\S*)\s+/i,
    );
    if (front) {
      const tail = line.match(/(\d+)\s+(\d+)\s+(up|down|active|inactive|deactive)?\s*$/i);
      out.push({
        index: front[1],
        vlan: front[2],
        port: front[3],
        ontIndex: front[4],
        gemport: front[5],
        uservlan: front[6],
        inboundTt: tail?.[1] ?? null,
        outboundTt: tail?.[2] ?? null,
        state: tail?.[3] ?? null,
      });
      continue;
    }

    const simple = line.match(/^\s*(\d+)\s+(\d+)\s+(.*?)\s+(up|down|active|inactive)\s*$/i);
    if (simple) {
      out.push({
        index: simple[1],
        vlan: simple[2],
        port: null,
        ontIndex: null,
        gemport: null,
        uservlan: null,
        inboundTt: null,
        outboundTt: null,
        state: simple[4],
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

const AddSpBody2 = Creds.extend({
  vlan: z.coerce.number().int().min(1).max(4094),
  gponPort: z.string().regex(/^\d+\/\d+\/\d+$/),
  ontIndex: z.coerce.number().int().nonnegative(),
  gemport: z.coerce.number().int().nonnegative(),
  uservlan: z.coerce.number().int().min(1).max(4094),
  trafficTable: z.coerce.number().int().nonnegative().default(6),
});

router.post("/olt/service-port/add", ...requireWriter(), async (req, res): Promise<void> => {
  // Accept either `gponPort` (preferred — avoids `port` collision with creds.port)
  // or legacy `port` from earlier callers.
  const body = { ...req.body, gponPort: req.body?.gponPort ?? req.body?.port };
  const parsed = AddSpBody2.safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const out = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        await s.exec("config");
        const cmd =
          `service-port vlan ${d.vlan} gpon ${d.gponPort} ont ${d.ontIndex} ` +
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
      { host: d.host, port: d.port, username: d.username, password: d.password },
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

const ClearAlarmBody = Creds.extend({
  alarmId: z.string().min(1).max(64),
});

router.post("/olt/alarm/clear", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = ClearAlarmBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  // Reject anything that isn't a numeric / hex alarm id to avoid command
  // injection through a free-form string in writer-gated context.
  if (!/^[0-9A-Fa-fxX]+$/.test(d.alarmId)) {
    res.status(400).json({ error: "Invalid alarm id" });
    return;
  }
  try {
    const out = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => s.exec(`clear alarm ${d.alarmId}`),
    );
    res.json({ output: out, success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

// ─────────────────────────── OLT-SIDE USERS ───────────────────────────
//
// `(config)# terminal user name <name>` and friends manage CLI accounts on
// the OLT itself. The list endpoint runs `display terminal user all` and
// parses its (often multi-line) layout into structured rows. Mutating
// endpoints are writer-gated and run inside config mode.

interface OltTerminalUser {
  name: string;
  level: string | null;       // Common-User / Operator / Administrator
  status: string | null;      // enable / disable
  reenterNum: string | null;  // max simultaneous logins
  profile: string | null;     // assigned profile name (if any)
  appendInfo: string | null;  // descriptive text (if any)
}

/**
 * `display terminal user all` on EA5800 firmware comes in two shapes:
 *
 *   (A) Tabular — single row per user:
 *     "  User-name  Status  Level         Reenter-num  Online ..."
 *     "  root      enable  Administrator 4            yes     ..."
 *
 *   (B) Block per user (one User-name per multi-line stanza):
 *     "  User-name        : root"
 *     "  User-level       : Administrator"
 *     "  Reenter-num      : 4"
 *     ...
 *
 * We try the block form first (more reliable when the table wraps), then
 * fall back to a permissive table parser.
 */
function parseTerminalUsers(text: string): OltTerminalUser[] {
  const out: OltTerminalUser[] = [];

  // (B) Block-per-user form.
  let cur: OltTerminalUser | null = null;
  const flush = () => {
    if (cur && cur.name) out.push(cur);
    cur = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const nameM = line.match(/^\s*User[-\s]?name\s*[:=]\s*(\S+)/i);
    if (nameM) {
      flush();
      cur = {
        name: nameM[1],
        level: null,
        status: null,
        reenterNum: null,
        profile: null,
        appendInfo: null,
      };
      continue;
    }
    if (!cur) continue;
    const lvl = line.match(/^\s*User[-\s]?level\s*[:=]\s*(.+)$/i);
    if (lvl) cur.level = lvl[1].trim();
    const st = line.match(/^\s*(?:User[-\s]?)?(?:Status|State)\s*[:=]\s*(\S+)/i);
    if (st) cur.status = st[1];
    const rn = line.match(/^\s*Re[-\s]?enter[-\s]?num\s*[:=]\s*(\S+)/i);
    if (rn) cur.reenterNum = rn[1];
    const pf = line.match(/^\s*Profile(?:\s+name)?\s*[:=]\s*(.+)$/i);
    if (pf) cur.profile = pf[1].trim();
    const ai = line.match(/^\s*Append[-\s]?info\s*[:=]\s*(.+)$/i);
    if (ai) cur.appendInfo = ai[1].trim();
  }
  flush();
  if (out.length > 0) return out;

  // (A) Tabular fallback.
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line || /^[-=\s]+$/.test(line)) continue;
    if (/^\s*User[-\s]?name\b/i.test(line)) continue; // header
    // name  status  level  reenter ...
    const m = line.match(
      /^\s*([A-Za-z0-9_\-]{1,32})\s+(enable|disable)\s+(\S+)\s+(\d+)/i,
    );
    if (m) {
      out.push({
        name: m[1],
        status: m[2],
        level: m[3],
        reenterNum: m[4],
        profile: null,
        appendInfo: null,
      });
    }
  }
  return out;
}

router.post("/olt/users", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const data = await withOlt(creds, async (s) => {
      const text = await safeExec(s, "display terminal user all");
      return { users: parseTerminalUsers(text), raw: text };
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// Strict whitelists — these run inside writer-gated config mode where any
// stray character could become an additional CLI argument.
const OltUserName = z.string().regex(/^[A-Za-z0-9_\-]{1,32}$/);
const OltUserPassword = z.string().regex(/^[\x21-\x7E]{6,64}$/);
const OltUserLevel = z.enum(["common-user", "operator", "administrator"]);
const OltProfileName = z.string().regex(/^[A-Za-z0-9_\-]{1,32}$/).optional();
const OltAppendInfo = z.string().regex(/^[A-Za-z0-9_\-. ]{0,64}$/).optional();
const OltReenterNum = z.coerce.number().int().min(1).max(8).optional();

// `newPassword` (not `password`) so the new account password never collides
// with the SSH credentials carried in the same request body.
const AddUserBody = Creds.extend({
  name: OltUserName,
  newPassword: OltUserPassword,
  level: OltUserLevel,
  profile: OltProfileName,
  appendInfo: OltAppendInfo,
  reenterNum: OltReenterNum,
});

router.post("/olt/user/add", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = AddUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const out = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        await s.exec("config");
        // EA5800 V100R019 `terminal user name <name>` wizard prompts, in
        // documented order:
        //   1. User Access Level(visitor/operator/administrator)[operator]:
        //   2. Password:
        //   3. Confirm password:
        //   4. User profile name (<=15 chars), '?' - help, '-' - default[-]:
        //   5. User's reenter number(0~10)[3]:
        //   6. Allow modify the password by all users(yes/no)[no]:
        //   7. Append information(<=30 chars)[-]:
        // Some firmwares omit (6) entirely; the prompt-driven helper skips
        // missing prompts gracefully because each step waits for its
        // specific matcher.
        const wiz = await s.execInteractive(
          `terminal user name ${d.name}`,
          [
            { when: /User\s*Access\s*Level[^\n]*:\s*$/i, send: d.level, label: "user level" },
            { when: /(?:^|\n)\s*Password\s*:\s*$/i, send: d.newPassword, label: "password" },
            { when: /Confirm\s*password\s*:\s*$/i, send: d.newPassword, label: "confirm password" },
            { when: /User\s*profile\s*name[^\n]*:\s*$/i, send: d.profile ?? "-", label: "profile" },
            { when: /reenter\s*number[^\n]*:\s*$/i, send: String(d.reenterNum ?? 3), label: "reenter number" },
            { when: /Allow\s*modify\s*the\s*password[^\n]*:\s*$/i, send: "no", label: "allow-modify" },
            { when: /Append\s*information[^\n]*:\s*$/i, send: d.appendInfo ?? "-", label: "append info" },
          ],
          { stepTimeoutMs: 6000, totalTimeoutMs: 30000 },
        );
        await s.exec("quit");
        const success = wiz.failure === null;
        return {
          output: wiz.transcript,
          error: wiz.failure ?? undefined,
          stepsCompleted: wiz.completedSteps,
          success,
        };
      },
    );
    res.json(out);
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

const DelUserBody = Creds.extend({ name: OltUserName });

router.post("/olt/user/delete", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = DelUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const result = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        await s.exec("config");
        // EA5800 prompts: "Are you sure to delete user <name>? (y/n)[n]:"
        // Some firmware variants phrase it as "Confirm to delete? (y/n)" or
        // skip the confirmation entirely; the matcher covers both.
        const wiz = await s.execInteractive(
          `undo terminal user name ${d.name}`,
          [
            { when: /(?:Are you sure|Confirm)[^\n]*\(\s*y\s*\/\s*n\s*\)[^\n]*:\s*$/i, send: "y", label: "delete confirm" },
          ],
          { stepTimeoutMs: 5000, totalTimeoutMs: 20000 },
        );
        await s.exec("quit");
        return {
          output: wiz.transcript,
          error: wiz.failure ?? undefined,
          success: wiz.failure === null,
        };
      },
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

const ChangePwBody = Creds.extend({
  name: OltUserName,
  newPassword: OltUserPassword,
});

router.post("/olt/user/password", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = ChangePwBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const result = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        await s.exec("config");
        // `terminal user password <name>` (admin changing another user)
        // typically prompts:
        //   New password:
        //   Confirm password:
        // It does NOT ask for the old password (that's the
        // "modify-mode forced" / self-change case). Some firmwares phrase
        // the second prompt as "Re-enter password:".
        const wiz = await s.execInteractive(
          `terminal user password ${d.name}`,
          [
            { when: /(?:^|\n)\s*New\s*password\s*:\s*$/i, send: d.newPassword, label: "new password" },
            { when: /(?:Confirm|Re-?enter)\s*password\s*:\s*$/i, send: d.newPassword, label: "confirm password" },
          ],
          { stepTimeoutMs: 5000, totalTimeoutMs: 20000 },
        );
        await s.exec("quit");
        return {
          output: wiz.transcript,
          error: wiz.failure ?? undefined,
          success: wiz.failure === null,
        };
      },
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

// ─────────────────────────── PASSWORD POLICY ───────────────────────────

/**
 * Scrape a Huawei-style failure line from a single CLI command's output.
 * Mirrors the helper in huawei-olt.ts but is local so we don't have to
 * re-export it; falls back to null when no error tokens are present.
 */
function scrapePolicyFailure(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(Failure|Error|%)\s*[:.]?\s*\S/i.test(line)) return line;
    if (/(invalid (?:value|parameter|input)|out of range|denied|unsupported)/i.test(line)) {
      return line;
    }
  }
  return null;
}


interface PasswordPolicy {
  minLength: number | null;
  agingDays: number | null;
  modifyMode: string | null;     // forced | recommended | none
  complexity: string | null;     // free-form description if firmware reports it
}

function parsePasswordPolicy(text: string): PasswordPolicy {
  const num = (re: RegExp): number | null => {
    const m = text.match(re);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
  };
  const str = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    minLength: num(/(?:Minimum|Min(?:imum)?)\s+(?:password\s+)?length\s*[:=]\s*(\d+)/i),
    agingDays: num(/Aging[-\s]?(?:time|days?)\s*[:=]\s*(\d+)/i),
    modifyMode: str(/Modify[-\s]?mode\s*[:=]\s*(\S+)/i),
    complexity: str(/Complexity(?:\s+check)?\s*[:=]\s*([^\r\n]+)/i),
  };
}

router.post("/olt/password-policy", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const data = await withOlt(creds, async (s) => {
      const text = await safeExec(s, "display terminal user password configuration");
      return { policy: parsePasswordPolicy(text), raw: text };
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

const SetPolicyBody = Creds.extend({
  minLength: z.coerce.number().int().min(1).max(32).optional(),
  agingDays: z.coerce.number().int().min(0).max(999).optional(),
  modifyMode: z.enum(["forced", "recommended", "none"]).optional(),
});

router.post("/olt/password-policy/set", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = SetPolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  if (d.minLength == null && d.agingDays == null && d.modifyMode == null) {
    res.status(400).json({ error: "Provide at least one policy field to update" });
    return;
  }
  try {
    const result = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        await s.exec("config");
        // Track the first failure across the (potentially) three sub-commands
        // so we can surface a structured `error` consistent with the other
        // /olt/user/* routes.
        const outputs: string[] = [];
        let firstFailure: string | null = null;
        const recordSubcommand = (label: string, transcript: string) => {
          outputs.push(`# ${label}\n${transcript}`);
          if (firstFailure) return;
          const f = scrapePolicyFailure(transcript);
          if (f) firstFailure = `${label}: ${f}`;
        };

        if (d.minLength != null) {
          recordSubcommand(
            `length ${d.minLength}`,
            await s.exec(`terminal user password length ${d.minLength}`),
          );
        }
        if (d.agingDays != null) {
          recordSubcommand(
            `aging-time ${d.agingDays}`,
            await s.exec(`terminal user password aging-time ${d.agingDays}`),
          );
        }
        if (d.modifyMode) {
          // `terminal user password modify-mode <mode>` may prompt
          // "Are you sure to change the modify-mode? (y/n)[n]:" on EA5800.
          const wiz = await s.execInteractive(
            `terminal user password modify-mode ${d.modifyMode}`,
            [
              { when: /(?:Are you sure|Confirm)[^\n]*\(\s*y\s*\/\s*n\s*\)[^\n]*:\s*$/i, send: "y", label: "modify-mode confirm" },
            ],
            { stepTimeoutMs: 4000, totalTimeoutMs: 12000 },
          );
          outputs.push(`# modify-mode ${d.modifyMode}\n${wiz.transcript}`);
          if (!firstFailure && wiz.failure) {
            firstFailure = `modify-mode: ${wiz.failure}`;
          }
        }
        await s.exec("quit");
        return {
          output: outputs.join("\n---\n"),
          error: firstFailure ?? undefined,
          success: firstFailure === null,
        };
      },
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

// ─────────────────────────── USER LOGIN HISTORY ───────────────────────────

interface OltUserSession {
  /** stable id for React keys: "active:<idx>" or "log:<row#>" */
  id: string;
  username: string;
  sourceIp: string | null;
  loginAt: string | null;
  logoutAt: string | null;
  /** ssh / telnet / console / web / etc. */
  channel: string | null;
  /** success / fail / null (null = unknown / current) */
  result: string | null;
  /** true if this row represents a currently-online session */
  active: boolean;
  /** opaque handle the OLT understands for `kick off user` (e.g. user-index) */
  kickHandle: string | null;
}

/**
 * Parse `display online user`. EA5800 V100R019 prints something like:
 *
 *   User-Index   User-Name        User-Type   User-Level     Login-Time            Login-From
 *   ------------------------------------------------------------------------------------------
 *   0            root             SSH         Administrator  2024-04-15 10:23:45   192.168.1.5
 *   1            admin            Telnet      Operator       2024-04-16 09:11:02   10.0.0.7
 *
 * Column ordering varies by firmware so we look for the four anchors we
 * need (name, type, time-stamp-ish token, ip-ish token) per line and don't
 * depend on a fixed column layout.
 */
function parseOnlineUsers(text: string): OltUserSession[] {
  const out: OltUserSession[] = [];
  let row = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line || /^[-=\s]+$/.test(line)) continue;
    if (/^\s*User[-\s]?Index\b|^\s*Index\s+User|^\s*User[-\s]?Name\s+(?:User[-\s]?Type|Login)/i.test(line)) continue;
    // Skip totals like "Total: 2"
    if (/^\s*Total\b/i.test(line)) continue;
    // Pull the timestamp (login time) so we don't mistake it for an IP token.
    const tsMatch = line.match(/(\d{4}-\d{1,2}-\d{1,2}[ T]\d{1,2}:\d{2}(?::\d{2})?)/);
    const ipMatch = line.match(/((?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|[0-9a-f:]+::?[0-9a-f:]+)/i);
    // Channel/type tokens we expect on this line.
    const chanMatch = line.match(/\b(ssh|telnet|console|web|http|https|ftp|snmp)\b/i);
    // First whitespace-separated columns: index?, name
    const cols = line.split(/\s+/).filter(Boolean);
    if (cols.length < 2) continue;
    let idx: string | null = null;
    let nameIdx = 0;
    if (/^\d+$/.test(cols[0])) {
      idx = cols[0];
      nameIdx = 1;
    }
    const name = cols[nameIdx];
    if (!name || !/^[A-Za-z0-9_\-.]{1,32}$/.test(name)) continue;
    out.push({
      id: `active:${idx ?? row}`,
      username: name,
      sourceIp: ipMatch ? ipMatch[1] : null,
      loginAt: tsMatch ? tsMatch[1] : null,
      logoutAt: null,
      channel: chanMatch ? chanMatch[1].toLowerCase() : null,
      result: null,
      active: true,
      kickHandle: idx,
    });
    row += 1;
  }
  return out;
}

/**
 * One raw event extracted from `display security log`. The log is
 * line-oriented (one event per line) and we correlate login/logout
 * events into sessions in a second pass.
 */
interface RawSecurityEvent {
  kind: "login" | "logout" | "fail";
  at: string;        // raw timestamp string from the device
  username: string;
  sourceIp: string | null;
  channel: string | null;
}

/** Parse a single security-log line into a RawSecurityEvent, or null. */
function parseSecurityLine(line: string): RawSecurityEvent | null {
  if (!line) return null;
  if (/^[-=]+$/.test(line)) return null;
  if (/^(?:Total|---- More|Press|Index)/i.test(line)) return null;
  const evt = line.match(/\b(login\s*fail(?:ed|ure)?|login|logout|kick(?:ed)?(?:[-\s]?off)?)\b/i);
  if (!evt) return null;
  const tsMatch = line.match(/(\d{4}-\d{1,2}-\d{1,2}[ T]\d{1,2}:\d{2}(?::\d{2})?)/);
  if (!tsMatch) return null;
  let name: string | null = null;
  const named = line.match(/\buser(?:[-\s]?name)?\s*[:=]?\s*([A-Za-z0-9_\-.]{1,32})/i);
  if (named) name = named[1];
  else {
    const q = line.match(/'([A-Za-z0-9_\-.]{1,32})'|"([A-Za-z0-9_\-.]{1,32})"/);
    if (q) name = q[1] ?? q[2] ?? null;
  }
  if (!name) return null;
  const ipMatch = line.match(/((?:\d{1,3}\.){3}\d{1,3}(?::\d+)?)/);
  const channel = (line.match(/\b(ssh|telnet|console|web|http|https|ftp|snmp)\b/i) || [])[1] ?? null;
  const kind: RawSecurityEvent["kind"] = /fail/i.test(evt[1])
    ? "fail"
    : /logout|kick/i.test(evt[1])
    ? "logout"
    : "login";
  return {
    kind,
    at: tsMatch[1],
    username: name,
    sourceIp: ipMatch ? ipMatch[1] : null,
    channel: channel ? channel.toLowerCase() : null,
  };
}

/**
 * Parse `display security log`, correlating each login event with the
 * matching subsequent logout/kick to produce session rows that have both
 * `loginAt` and `logoutAt` populated.
 *
 * Pairing rules (in priority order, all chronological):
 *   1) Same username + same source IP + same channel
 *   2) Same username + same source IP
 *   3) Same username
 *
 * A login with no matching logout becomes an "open" historical row
 * (logoutAt: null) — it is later de-duped against the live `display
 * online user` list by the caller. Failed logins are always standalone
 * rows (loginAt set, logoutAt null, result "fail").
 */
function parseSecurityLog(text: string): OltUserSession[] {
  const events: RawSecurityEvent[] = [];
  for (const raw of text.split("\n")) {
    const ev = parseSecurityLine(raw.trim());
    if (ev) events.push(ev);
  }
  // The OLT prints oldest → newest; rely on that ordering for pairing.
  // Maintain a per-key queue of unmatched logins.
  const open: Array<RawSecurityEvent & { _idx: number }> = [];
  const sessions: OltUserSession[] = [];
  let row = 0;
  const matchScore = (
    login: RawSecurityEvent,
    logout: RawSecurityEvent,
  ): number => {
    if (login.username !== logout.username) return -1;
    let s = 1;
    if (login.sourceIp && logout.sourceIp && login.sourceIp === logout.sourceIp) s += 2;
    if (login.channel && logout.channel && login.channel === logout.channel) s += 1;
    return s;
  };
  for (const ev of events) {
    if (ev.kind === "fail") {
      sessions.push({
        id: `log:${row++}`,
        username: ev.username,
        sourceIp: ev.sourceIp,
        loginAt: ev.at,
        logoutAt: null,
        channel: ev.channel,
        result: "fail",
        active: false,
        kickHandle: null,
      });
      continue;
    }
    if (ev.kind === "login") {
      open.push({ ...ev, _idx: open.length });
      continue;
    }
    // logout/kick: find the best (highest score, most recent) open login.
    let bestI = -1;
    let bestScore = 0;
    for (let i = open.length - 1; i >= 0; i--) {
      const score = matchScore(open[i], ev);
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }
    if (bestI === -1) {
      // Orphan logout — record it on its own so admins still see it.
      sessions.push({
        id: `log:${row++}`,
        username: ev.username,
        sourceIp: ev.sourceIp,
        loginAt: null,
        logoutAt: ev.at,
        channel: ev.channel,
        result: "success",
        active: false,
        kickHandle: null,
      });
      continue;
    }
    const login = open[bestI];
    open.splice(bestI, 1);
    sessions.push({
      id: `log:${row++}`,
      username: login.username,
      sourceIp: login.sourceIp ?? ev.sourceIp,
      loginAt: login.at,
      logoutAt: ev.at,
      channel: login.channel ?? ev.channel,
      result: "success",
      active: false,
      kickHandle: null,
    });
  }
  // Any remaining unmatched logins become open historical rows. The
  // caller will drop them if a matching active session exists.
  for (const login of open) {
    sessions.push({
      id: `log:${row++}`,
      username: login.username,
      sourceIp: login.sourceIp,
      loginAt: login.at,
      logoutAt: null,
      channel: login.channel,
      result: "success",
      active: false,
      kickHandle: null,
    });
  }
  return sessions;
}

/**
 * Mirror live + security-log sessions into the `olt_login_events` audit
 * table. Returns the number of newly-recorded rows. Errors are swallowed
 * so the live `/olt/user-logins` response is never blocked by an audit
 * write — admins still see the device data, and the next poll will
 * retry the ingest.
 */
async function ingestLoginEvents(
  ownerUserId: string,
  host: string,
  active: OltUserSession[],
  history: OltUserSession[],
): Promise<number> {
  const all = [...active, ...history];
  if (all.length === 0) return 0;
  let inserted = 0;
  const now = new Date();
  for (const s of all) {
    if (!s.username) continue;
    // Failed logins are standalone rows; closed sessions might have only a
    // logoutAt; active sessions might have only a loginAt. We dedup on the
    // login timestamp string, so failed/orphan rows still get a stable key.
    const loginAtRaw = s.loginAt ?? "";
    // Empty-string sentinel keeps `channel` participating in the dedup
    // unique index — Postgres treats NULL values as distinct, so a real
    // NULL would let the same event re-insert on every poll.
    const channel = s.channel ?? "";
    const result =
      s.result === "fail" ? "fail" : "success";
    try {
      const r = await db
        .insert(oltLoginEventsTable)
        .values({
          ownerUserId,
          host,
          username: s.username,
          sourceIp: s.sourceIp,
          channel,
          loginAt: parseDeviceTimestamp(s.loginAt),
          loginAtRaw,
          logoutAt: parseDeviceTimestamp(s.logoutAt),
          logoutAtRaw: s.logoutAt,
          result,
          seenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [
            oltLoginEventsTable.ownerUserId,
            oltLoginEventsTable.host,
            oltLoginEventsTable.username,
            oltLoginEventsTable.loginAtRaw,
            oltLoginEventsTable.channel,
          ],
          set: {
            // Keep refreshing the logout / source-ip when a session that
            // was previously open finally gets a logout event.
            logoutAt: parseDeviceTimestamp(s.logoutAt),
            logoutAtRaw: s.logoutAt,
            sourceIp: s.sourceIp,
            lastSeenAt: now,
          },
        })
        .returning({ id: oltLoginEventsTable.id, seenAt: oltLoginEventsTable.seenAt });
      // `returning` always emits one row for ON CONFLICT DO UPDATE; we
      // count it as "inserted" only when the seenAt matches the current
      // tick (i.e. it's brand new, not an update).
      if (r[0] && Math.abs(r[0].seenAt.getTime() - now.getTime()) < 1000) {
        inserted += 1;
      }
    } catch (err) {
      console.warn("[olt] login-event ingest failed:", err);
    }
  }
  return inserted;
}

/**
 * Parse a device timestamp like "2024-04-15 10:23:45" or
 * "2024-04-15T10:23". Returns null for unparseable / null inputs.
 */
function parseDeviceTimestamp(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Normalise space → T so Date can parse it as ISO-ish.
  const iso = trimmed.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Reject dates in the far past (epoch/1970) — usually parser bugs.
  if (d.getFullYear() < 2000) return null;
  return d;
}

router.post("/olt/user-logins", async (req, res): Promise<void> => {
  const creds = parseCreds(req, res);
  if (!creds) return;
  try {
    const data = await withOlt(creds, async (s) => {
      // Both display commands are read-only and run from user view.
      const [onlineRaw, logRaw] = await Promise.all([
        safeExec(s, "display online user"),
        safeExec(s, "display security log"),
      ]);
      // De-dup: if a log row matches an active session (same user + same
      // login timestamp), prefer the active row so the UI shows it as live
      // (with a kick button).
      const active = parseOnlineUsers(onlineRaw);
      const activeKey = new Set(
        active.map((a) => `${a.username}|${a.loginAt ?? ""}`),
      );
      const history = parseSecurityLog(logRaw).filter(
        (r) => !activeKey.has(`${r.username}|${r.loginAt ?? ""}`),
      );
      // Sort history newest-first (using whichever timestamp is present),
      // then prepend active sessions so live rows always appear at the top.
      const ts = (r: OltUserSession): string => r.logoutAt ?? r.loginAt ?? "";
      history.sort((a, b) => ts(b).localeCompare(ts(a)));
      active.sort((a, b) => (b.loginAt ?? "").localeCompare(a.loginAt ?? ""));
      return {
        sessions: [...active, ...history],
        rawOnline: onlineRaw,
        rawLog: logRaw,
        active,
        history,
      };
    });
    // Mirror into the audit table for permanent retention. Best-effort —
    // never block the live response on a DB write.
    let ingested = 0;
    if (req.userId) {
      try {
        ingested = await ingestLoginEvents(
          req.userId,
          creds.host,
          data.active,
          data.history,
        );
      } catch (err) {
        console.warn("[olt] login-event ingest job failed:", err);
      }
    }
    res.json({
      sessions: data.sessions,
      rawOnline: data.rawOnline,
      rawLog: data.rawLog,
      ingested,
    });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// ─────────────────────────── HISTORICAL LOGIN AUDIT ───────────────────────────
//
// Every poll of /olt/user-logins mirrors events into `olt_login_events`. The
// endpoints below let admins browse, filter, and (for writers) purge that
// permanent record so they can answer questions like "who signed in last
// month?" or "show every failed login from this IP" even after the OLT has
// rotated its own log.

const HistoryQuery = z.object({
  host: z.string().min(1).optional(),
  /** ISO date or date-time; lower bound on login_at (or logout_at when login is null) */
  from: z.string().optional(),
  /** ISO date or date-time; upper bound on login_at */
  to: z.string().optional(),
  username: z.string().min(1).max(64).optional(),
  sourceIp: z.string().min(1).max(64).optional(),
  channel: z.string().min(1).max(32).optional(),
  result: z.enum(["success", "fail"]).optional(),
  limit: z.coerce.number().int().positive().max(1000).default(200),
  offset: z.coerce.number().int().nonnegative().default(0),
});

interface HistoryRow {
  id: number;
  host: string;
  username: string;
  sourceIp: string | null;
  channel: string | null;
  loginAt: string | null;
  loginAtRaw: string;
  logoutAt: string | null;
  logoutAtRaw: string | null;
  result: string;
  seenAt: string;
  lastSeenAt: string;
}

// ─── Shared filter logic for the JSON + CSV history endpoints ────────────
//
// Both `/olt/login-history` (JSON, paginated) and `/olt/login-history.csv`
// (streamed export) project the same filtered slice of `olt_login_events`.
// Keeping the WHERE / ORDER BY in one place is what guarantees the on-screen
// view and the downloaded CSV never silently disagree — adding a new filter
// (or tweaking how date bounds work) means editing exactly one helper, not
// two parallel copies that have to stay byte-identical by code review alone.

/**
 * Resolved filter set after date-string parsing — what `historyWhere` and
 * `buildHistorySelect` consume. Pagination (`limit` / `offset`) is owned
 * by each endpoint since it differs between them.
 */
export interface HistoryFilters {
  host?: string;
  username?: string;
  sourceIp?: string;
  channel?: string;
  result?: "success" | "fail";
  fromDate: Date | null;
  toDate: Date | null;
}

/** Subset of the parsed query that `parseHistoryFilters` needs. */
type HistoryFilterInput = Pick<
  z.infer<typeof HistoryQuery>,
  "host" | "from" | "to" | "username" | "sourceIp" | "channel" | "result"
>;

/**
 * Validate the date strings in a parsed history query and resolve them
 * into Date objects. Returns either the canonical filter set or a
 * 400-eligible error message identical to what each endpoint used to
 * produce inline.
 */
export function parseHistoryFilters(
  q: HistoryFilterInput,
): { ok: true; filters: HistoryFilters } | { ok: false; error: string } {
  const fromDate = q.from ? parseDeviceTimestamp(q.from) : null;
  const toDate = q.to ? parseDeviceTimestamp(q.to) : null;
  if (q.from && !fromDate) return { ok: false, error: "Invalid `from` timestamp" };
  if (q.to && !toDate) return { ok: false, error: "Invalid `to` timestamp" };
  return {
    ok: true,
    filters: {
      host: q.host,
      username: q.username,
      sourceIp: q.sourceIp,
      channel: q.channel,
      result: q.result,
      fromDate,
      toDate,
    },
  };
}

/**
 * Build the parameterized WHERE clause shared by every history read
 * (JSON list, JSON count, CSV stream). Always scoped to the calling
 * user's events. Date filters coalesce to `logout_at` so orphan logout
 * rows / unparseable device timestamps don't silently disappear from
 * the caller's range.
 */
export function historyWhere(userId: string, filters: HistoryFilters) {
  const conds = [eq(oltLoginEventsTable.ownerUserId, userId)];
  if (filters.host) conds.push(eq(oltLoginEventsTable.host, filters.host));
  if (filters.username) conds.push(eq(oltLoginEventsTable.username, filters.username));
  if (filters.sourceIp) conds.push(ilike(oltLoginEventsTable.sourceIp, `%${filters.sourceIp}%`));
  if (filters.channel) conds.push(eq(oltLoginEventsTable.channel, filters.channel.toLowerCase()));
  if (filters.result) conds.push(eq(oltLoginEventsTable.result, filters.result));
  if (filters.fromDate) conds.push(sql`coalesce(${oltLoginEventsTable.loginAt}, ${oltLoginEventsTable.logoutAt}) >= ${filters.fromDate}`);
  if (filters.toDate) conds.push(sql`coalesce(${oltLoginEventsTable.loginAt}, ${oltLoginEventsTable.logoutAt}) <= ${filters.toDate}`);
  return conds.length === 1 ? conds[0] : and(...conds);
}

/**
 * Build a Drizzle dynamic SELECT over `olt_login_events` with the shared
 * WHERE and the canonical history ORDER BY applied. Callers add LIMIT /
 * OFFSET (or hand it to a cursor) as needed.
 */
export function buildHistorySelect(userId: string, filters: HistoryFilters) {
  return db
    .select()
    .from(oltLoginEventsTable)
    .where(historyWhere(userId, filters))
    .orderBy(
      sql`coalesce(${oltLoginEventsTable.loginAt}, ${oltLoginEventsTable.logoutAt}) desc nulls last`,
      desc(oltLoginEventsTable.id),
    )
    .$dynamic();
}

router.get("/olt/login-history", async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const parsed = HistoryQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const q = parsed.data;
  const filterRes = parseHistoryFilters(q);
  if (!filterRes.ok) { res.status(400).json({ error: filterRes.error }); return; }
  const filters = filterRes.filters;

  try {
    const where = historyWhere(userId, filters);
    const rows = await buildHistorySelect(userId, filters)
      .limit(q.limit)
      .offset(q.offset);
    const totalRow = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(oltLoginEventsTable)
      .where(where);
    const events: HistoryRow[] = rows.map((r) => ({
      id: r.id,
      host: r.host,
      username: r.username,
      sourceIp: r.sourceIp,
      channel: r.channel,
      loginAt: r.loginAt ? r.loginAt.toISOString() : null,
      loginAtRaw: r.loginAtRaw,
      logoutAt: r.logoutAt ? r.logoutAt.toISOString() : null,
      logoutAtRaw: r.logoutAtRaw,
      result: r.result,
      seenAt: r.seenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
    }));
    res.json({
      events,
      total: totalRow[0]?.n ?? 0,
      limit: q.limit,
      offset: q.offset,
    });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// CSV export of the same filtered set the GET endpoint serves. Lets ops hand
// raw rows to security / compliance reviewers without paginating through the
// UI. Same auth as GET (any authed user — read-only is allowed).
//
// Unlike the JSON endpoint, this route streams rows from Postgres straight
// to the response body via a server-side cursor, so memory stays flat
// regardless of result size. There is no implicit row cap; callers may
// still pass `limit` to truncate, with a defensive ceiling of 10M to bound
// worst-case query time.
const CsvQuery = HistoryQuery.extend({
  // Optional. Omit for "everything that matches the filters".
  limit: z.coerce.number().int().positive().max(10_000_000).optional(),
  // Pagination offset is meaningless for a full export; default to 0 and
  // accept it only for edge-case callers who want to skip a known prefix.
  offset: z.coerce.number().int().nonnegative().default(0),
});

// How many rows the cursor pulls per network round-trip. Larger = fewer
// round-trips but more memory per batch. 1000 keeps batch memory in the
// low-MB range for our row size (~10 short text cols + 2 timestamps).
const CSV_CURSOR_BATCH = 1000;

// Characters that, when leading a CSV cell, are interpreted as formulas by
// Excel / Google Sheets / LibreOffice. An attacker who can inject one of
// these into a string field (host, username, source-ip, channel, ...) could
// trigger code execution when the operator opens the export. Standard
// mitigation: prefix the cell with a single quote so the spreadsheet treats
// it as text. Quoting alone (CSV escaping) does NOT prevent this — the
// formula engine runs on the *unquoted* cell value after CSV parsing.
// See: OWASP "CSV Injection" / CWE-1236.
const CSV_FORMULA_LEADERS = /^[=+\-@\t\r]/;

function csvField(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (CSV_FORMULA_LEADERS.test(s)) s = `'${s}`;
  // Always quote: handles commas, quotes, newlines, and leading-zero/exponent
  // weirdness consistently. Embedded quotes are escaped by doubling.
  return `"${s.replace(/"/g, '""')}"`;
}

function safeFilenamePart(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 64) || "all";
}

router.get("/olt/login-history.csv", async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const parsed = CsvQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const q = parsed.data;
  const filterRes = parseHistoryFilters(q);
  if (!filterRes.ok) { res.status(400).json({ error: filterRes.error }); return; }
  const filters = filterRes.filters;

  // Reuse the shared SELECT builder so WHERE/ORDER BY parity with the JSON
  // endpoint is structural — adding a new filter to `historyWhere` flows
  // through here automatically. Then hand the resulting SQL + params to
  // a raw pg cursor for true row-by-row streaming.
  let builder = buildHistorySelect(userId, filters);
  if (q.limit !== undefined) builder = builder.limit(q.limit);
  if (q.offset > 0) builder = builder.offset(q.offset);
  const { sql: queryText, params } = builder.toSQL();

  // Build a stable, archival filename: olt-login-history__<host>__<from>_<to>.csv
  const hostPart = safeFilenamePart(q.host ?? "all-hosts");
  const fromPart = safeFilenamePart(q.from ?? "earliest");
  const toPart = safeFilenamePart(q.to ?? "latest");
  const filename = `olt-login-history__${hostPart}__${fromPart}_${toPart}.csv`;

  // Acquire a dedicated client up front. Cursors only work within a single
  // connection, so we cannot use the pool's auto-checkout convenience here.
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
    return;
  }

  // From here on, headers will be flushed almost immediately. Any failure
  // mid-stream cannot be reported as JSON — the best we can do is destroy
  // the response so the browser sees a truncated download (and we log it
  // server-side via the route's error handler).
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  // Force chunked transfer; we don't know the total length up front.
  res.setHeader("Transfer-Encoding", "chunked");

  // Header row (UTF-8 BOM up front so Excel opens it correctly).
  res.write("\uFEFF");
  res.write(
    [
      "host",
      "username",
      "source_ip",
      "channel",
      "login_at",
      "logout_at",
      "result",
      "seen_at",
    ].map(csvField).join(",") + "\r\n",
  );

  // pg-query-stream returns rows with the *database* column names
  // (snake_case), not Drizzle's camelCase field names, since we bypass
  // the ORM's row decoder. Define a narrow shape so this layer is
  // type-safe without re-deriving from the Drizzle schema.
  type CsvRow = {
    host: string;
    username: string;
    source_ip: string | null;
    channel: string;
    login_at: Date | null;
    login_at_raw: string;
    logout_at: Date | null;
    logout_at_raw: string | null;
    result: string;
    seen_at: Date;
  };

  // Track whether the HTTP client has gone away. We need this for two
  // reasons: (a) so a `drain` await doesn't hang forever if the socket
  // closes mid-write, and (b) so we tear down the cursor instead of
  // pulling rows nobody will read.
  let aborted = false;
  let dbStream: QueryStream | null = null;
  const onClientAbort = () => {
    aborted = true;
    if (dbStream) dbStream.destroy();
  };
  res.on("close", onClientAbort);

  try {
    dbStream = new QueryStream(queryText, params, {
      batchSize: CSV_CURSOR_BATCH,
    });
    // `client.query(queryStream)` is the canonical pg-query-stream invocation
    // — it wires the cursor into the live connection. The return value here
    // is the same QueryStream instance (typed `void` by node-pg's callback
    // overload), so we keep our existing reference.
    client.query(dbStream);

    for await (const raw of dbStream as unknown as AsyncIterable<CsvRow>) {
      if (aborted) break;
      const line =
        [
          csvField(raw.host),
          csvField(raw.username),
          csvField(raw.source_ip),
          csvField(raw.channel),
          csvField(raw.login_at ? raw.login_at.toISOString() : raw.login_at_raw),
          csvField(raw.logout_at ? raw.logout_at.toISOString() : raw.logout_at_raw),
          csvField(raw.result),
          csvField(raw.seen_at.toISOString()),
        ].join(",") + "\r\n";
      // Honor backpressure: if the socket buffer is full, wait for it to
      // drain before pulling the next row from Postgres. Without this
      // guard a slow client lets node's internal write buffer balloon
      // — defeating the whole point of streaming.
      //
      // We race `drain` against `close`/`error` so a client that gives
      // up mid-stream cannot leave us waiting on a `drain` event that
      // will never come (which would hold the pool client open
      // indefinitely). `Promise.race` resolves on the first of the
      // three; the other listeners are then garbage-collected by node.
      if (!res.write(line)) {
        await Promise.race([
          once(res, "drain"),
          once(res, "close"),
          once(res, "error"),
        ]);
        if (aborted) break;
      }
    }
    if (!aborted) res.end();
  } catch (err) {
    // Mid-stream failure (DB error, broken pipe, etc.). Headers are
    // already on the wire, so the best signal we can give the client
    // is an abrupt connection close — better than silently truncating
    // and pretending the export succeeded. If the client was the one
    // that disconnected, downgrade to a debug log to avoid noise.
    if (aborted) {
      console.warn("[olt csv export] aborted by client mid-stream");
    } else {
      console.error("[olt csv export] stream error:", errMsg(err));
      res.destroy(err instanceof Error ? err : new Error(errMsg(err)));
    }
  } finally {
    res.off("close", onClientAbort);
    // Destroying the cursor returns the underlying connection to a
    // usable state before we release it back to the pool. If the
    // cursor was never created (acquire failed earlier in try) this
    // is a no-op.
    if (dbStream && !dbStream.destroyed) dbStream.destroy();
    client.release();
  }
});

const PurgeQuery = z.object({
  /** Numeric event id — when set, deletes only that single row. */
  id: z.coerce.number().int().positive().optional(),
  host: z.string().min(1).optional(),
  /** Same semantics as history `to` — delete events with login_at <= before */
  before: z.string().optional(),
  /** Allow blanket "all my events" purges only when this flag is set. */
  all: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "1")
    .optional(),
});

router.delete("/olt/login-history", ...requireWriter(), async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  const parsed = PurgeQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const q = parsed.data;
  const before = q.before ? parseDeviceTimestamp(q.before) : null;
  if (q.before && !before) { res.status(400).json({ error: "Invalid `before` timestamp" }); return; }

  // Refuse a totally-unscoped delete unless the caller explicitly opts in.
  const hasAnyScope = q.id !== undefined || !!q.host || !!before;
  if (!hasAnyScope && !q.all) {
    res.status(400).json({
      error: "Refusing unscoped delete; pass id, host, before, or all=true",
    });
    return;
  }

  const conds = [eq(oltLoginEventsTable.ownerUserId, userId)];
  if (q.id !== undefined) conds.push(eq(oltLoginEventsTable.id, q.id));
  if (q.host) conds.push(eq(oltLoginEventsTable.host, q.host));
  // Match the GET semantics: fall back to logout_at when login_at is null
  // so a "before" cutoff can also remove orphan logout / unparsed rows.
  if (before) conds.push(sql`coalesce(${oltLoginEventsTable.loginAt}, ${oltLoginEventsTable.logoutAt}) <= ${before}`);

  try {
    const where = conds.length === 1 ? conds[0] : and(...conds);
    const r = await db
      .delete(oltLoginEventsTable)
      .where(where)
      .returning({ id: oltLoginEventsTable.id });
    res.json({ success: true, deleted: r.length });
  } catch (err) {
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

const KickBody = Creds.extend({
  /** Either username or numeric user-index; both are whitelisted below. */
  target: z.string().regex(/^[A-Za-z0-9_\-.]{1,32}$/),
  byIndex: z.boolean().optional(),
}).refine(
  (b) => !b.byIndex || /^\d{1,5}$/.test(b.target),
  { path: ["target"], message: "byIndex requires a numeric user-index target" },
);

router.post("/olt/user-logout", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = KickBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  try {
    const result = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        // EA5800 V100R019: `kick off user user-name <name>` (or
        // `user-index <n>`) — runs from user view, no confirmation.
        const cmd = d.byIndex
          ? `kick off user user-index ${d.target}`
          : `kick off user user-name ${d.target}`;
        const transcript = await s.exec(cmd);
        const failure = scrapePolicyFailure(transcript);
        return {
          output: transcript,
          error: failure ?? undefined,
          success: failure === null,
        };
      },
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
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
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => s.exec(d.command),
    );
    res.json({ output: output || "(no output)", success: true });
  } catch (err) {
    res.json({ output: `Error: ${errMsg(err)}`, success: false });
  }
});

// ─────────────────────────── BACKUP / CONFIG SNAPSHOTS ───────────────────────────
//
// EA5800-family OLTs persist their running config to flash with `save` and
// can dump the live config text via `display current-configuration`. This
// route does both: it commits to flash, captures the config text over the
// existing SSH shell, and (when object storage is configured) archives a
// timestamped copy under the caller's userId so historical snapshots are
// listable and downloadable from the UI.

const BackupBody = Creds.extend({
  store: z.boolean().optional(), // when true (default) upload to object storage if configured
});

interface SnapshotMeta {
  id: string;          // object name *within* the snapshots prefix (URL-safe)
  identity: string | null;
  host: string;
  filename: string;
  size: number;
  createdAt: string;   // ISO
}

function snapshotsPrefix(userId: string): string {
  let dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) return "";
  if (!dir.endsWith("/")) dir += "/";
  return `${dir}olt-snapshots/${userId}/`;
}

function safeIdentForFilename(s: string | null | undefined): string {
  return (s || "olt").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 64);
}

function isStorageConfigured(): boolean {
  return Boolean(
    process.env.PRIVATE_OBJECT_DIR && process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
  );
}

async function captureConfig(s: OltSession): Promise<{ saveOutput: string; config: string }> {
  // `save` prompts "Are you sure ... (y/n)" on EA5800. Send y to confirm.
  const saveOutput = await s.execScript(["save", "y"], { timeoutMs: 60000 });
  // Pull the live running config. Output can be tens of KB; allow plenty of time.
  const config = await s.exec("display current-configuration", { timeoutMs: 120000 });
  return { saveOutput, config };
}

router.post("/olt/backup", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = BackupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const userId = req.userId;
  const wantStore = d.store !== false;

  try {
    const { saveOutput, config, identity } = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        const probe = await probeOltIdentity(s);
        const cap = await captureConfig(s);
        return { ...cap, identity: probe.identity };
      },
    );

    const ts = new Date();
    const tsCompact = ts.toISOString().replace(/[:.]/g, "-");
    const filename = `${safeIdentForFilename(identity ?? d.host)}-${tsCompact}.cfg`;

    let stored: { id: string; path: string } | null = null;
    if (wantStore && userId && isStorageConfigured()) {
      try {
        const { objectStorageClient } = await import("../lib/objectStorage");
        const prefix = snapshotsPrefix(userId);
        // prefix looks like "/<bucket>/.private/olt-snapshots/<uid>/"
        const trimmed = prefix.startsWith("/") ? prefix.slice(1) : prefix;
        const slash = trimmed.indexOf("/");
        const bucketName = trimmed.slice(0, slash);
        const objectName = trimmed.slice(slash + 1) + filename;
        const bucket = objectStorageClient.bucket(bucketName);
        await bucket.file(objectName).save(Buffer.from(config, "utf-8"), {
          contentType: "text/plain; charset=utf-8",
          resumable: false,
          metadata: {
            metadata: {
              identity: identity ?? "",
              host: d.host,
              userId,
              createdAt: ts.toISOString(),
            },
          },
        });
        stored = { id: encodeURIComponent(filename), path: `${prefix}${filename}` };
      } catch (storeErr) {
        // Don't fail the download if archival fails — just surface the warning.
        console.warn("[olt] snapshot store failed:", storeErr);
      }
    }

    res.json({
      success: true,
      filename,
      identity: identity ?? null,
      host: d.host,
      saveOutput,
      config,
      stored,
      storageConfigured: isStorageConfigured(),
    });
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
  }
});

router.get("/olt/snapshots", ...requireWriter(), async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  if (!isStorageConfigured()) {
    res.json({ configured: false, snapshots: [] });
    return;
  }
  try {
    const { objectStorageClient } = await import("../lib/objectStorage");
    const prefix = snapshotsPrefix(userId);
    const trimmed = prefix.startsWith("/") ? prefix.slice(1) : prefix;
    const slash = trimmed.indexOf("/");
    const bucketName = trimmed.slice(0, slash);
    const objectPrefix = trimmed.slice(slash + 1);
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: objectPrefix });
    const snapshots: SnapshotMeta[] = files.map((f) => {
      const name = f.name.slice(objectPrefix.length);
      const md = (f.metadata?.metadata ?? {}) as Record<string, string>;
      const sizeRaw = (f.metadata as { size?: string | number } | undefined)?.size;
      const size = typeof sizeRaw === "string" ? parseInt(sizeRaw, 10) : (sizeRaw ?? 0);
      const created = (f.metadata as { timeCreated?: string } | undefined)?.timeCreated;
      return {
        id: encodeURIComponent(name),
        identity: md.identity || null,
        host: md.host || "",
        filename: name,
        size: Number.isFinite(size) ? size : 0,
        createdAt: md.createdAt || created || new Date(0).toISOString(),
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ configured: true, snapshots });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

function decodeSnapshotId(idRaw: string): string | null {
  if (!idRaw) return null;
  let filename: string;
  try { filename = decodeURIComponent(idRaw); } catch { return null; }
  if (filename.includes("/") || filename.includes("..") || filename.length > 256) return null;
  return filename;
}

router.get("/olt/snapshots/download", ...requireWriter(), async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  if (!isStorageConfigured()) { res.status(404).json({ error: "Object storage not configured" }); return; }
  const idRaw = typeof req.query.id === "string" ? req.query.id : "";
  const filename = decodeSnapshotId(idRaw);
  if (!filename) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const { objectStorageClient } = await import("../lib/objectStorage");
    const prefix = snapshotsPrefix(userId);
    const trimmed = prefix.startsWith("/") ? prefix.slice(1) : prefix;
    const slash = trimmed.indexOf("/");
    const bucketName = trimmed.slice(0, slash);
    const objectName = trimmed.slice(slash + 1) + filename;
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: "Snapshot not found" }); return; }
    const [buf] = await file.download();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.delete("/olt/snapshots", ...requireWriter(), async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
  if (!isStorageConfigured()) { res.status(404).json({ error: "Object storage not configured" }); return; }
  const idRaw = typeof req.query.id === "string" ? req.query.id : "";
  const filename = decodeSnapshotId(idRaw);
  if (!filename) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const { objectStorageClient } = await import("../lib/objectStorage");
    const prefix = snapshotsPrefix(userId);
    const trimmed = prefix.startsWith("/") ? prefix.slice(1) : prefix;
    const slash = trimmed.indexOf("/");
    const bucketName = trimmed.slice(0, slash);
    const objectName = trimmed.slice(slash + 1) + filename;
    await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

// Apply a previously captured config (or arbitrary text) to the OLT by
// replaying its lines in `config` mode. SmartAX has no "load saved-file
// over SSH" path, so we issue the saved CLI commands one at a time and
// surface any failure tokens. The route accepts either an archived
// snapshot id (resolved against the caller's storage prefix) or an
// inline `config` string for ad-hoc restores.
const RestoreBody = Creds.extend({
  snapshotId: z.string().min(1).max(256).optional(),
  config: z.string().min(1).max(2_000_000).optional(),
}).refine((d) => d.snapshotId || d.config, {
  message: "Provide snapshotId or config",
});

const SKIP_LINE = /^(\s*$|#|!|<.*>|\s*display\b|\s*Building configuration|\s*Saving|\s*Press|\s*Are you sure|\s*\[Y\/N\])/i;
const FAIL_TOKEN = /(failure|failed|invalid|denied|unrecognized|incomplete|ambiguous|error\b)/i;

router.post("/olt/restore", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = RestoreBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const userId = req.userId;

  let configText = d.config ?? "";
  if (!configText && d.snapshotId) {
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }
    if (!isStorageConfigured()) { res.status(400).json({ error: "Object storage not configured" }); return; }
    const filename = decodeSnapshotId(d.snapshotId);
    if (!filename) { res.status(400).json({ error: "Invalid snapshotId" }); return; }
    try {
      const { objectStorageClient } = await import("../lib/objectStorage");
      const prefix = snapshotsPrefix(userId);
      const trimmed = prefix.startsWith("/") ? prefix.slice(1) : prefix;
      const slash = trimmed.indexOf("/");
      const bucketName = trimmed.slice(0, slash);
      const objectName = trimmed.slice(slash + 1) + filename;
      const file = objectStorageClient.bucket(bucketName).file(objectName);
      const [exists] = await file.exists();
      if (!exists) { res.status(404).json({ error: "Snapshot not found" }); return; }
      const [buf] = await file.download();
      configText = buf.toString("utf-8");
    } catch (err) {
      res.status(500).json({ error: errMsg(err) }); return;
    }
  }

  // Filter the config into a list of replayable command lines.
  const lines = configText
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .filter((l) => !SKIP_LINE.test(l));

  if (lines.length === 0) {
    res.status(400).json({ error: "Snapshot has no replayable commands" }); return;
  }

  try {
    const result = await withOlt(
      { host: d.host, port: d.port, username: d.username, password: d.password },
      async (s) => {
        const transcript: string[] = [];
        const failures: { line: string; output: string }[] = [];
        await s.exec("config");
        for (const line of lines) {
          // Preserve structural commands (quit/return/end). The Huawei
          // dump uses them to step back out of interface / profile sub-
          // modes; skipping them would leave us in the wrong context for
          // the commands that follow.
          let out = "";
          try {
            out = await s.exec(line, { timeoutMs: 30000 });
          } catch (e) {
            out = `(exec error: ${e instanceof Error ? e.message : String(e)})`;
          }
          transcript.push(`> ${line}\n${out}`);
          if (FAIL_TOKEN.test(out)) failures.push({ line, output: out });
        }
        // Unwind to privileged mode regardless of how deeply nested we
        // ended up. `return` on VRP / SmartAX exits straight back to
        // user view from any sub-mode; ignore failure (already there).
        try { await s.exec("return", { timeoutMs: 5000 }); } catch { /* ignore */ }
        // Persist the new running config and treat a failing save as a
        // failed restore overall.
        const saveOutput = await s.execScript(["save", "y"], { timeoutMs: 60000 });
        const saveOk = !FAIL_TOKEN.test(saveOutput);
        return {
          appliedLines: lines.length,
          failureCount: failures.length,
          failures,
          transcript: transcript.join("\n"),
          saveOutput,
          saveOk,
        };
      },
    );
    res.json({ success: result.failureCount === 0 && result.saveOk, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: errMsg(err) });
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
