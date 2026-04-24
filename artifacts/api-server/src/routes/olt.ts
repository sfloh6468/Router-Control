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
        const outputs: string[] = [];
        if (d.minLength != null) {
          outputs.push(await s.exec(`terminal user password length ${d.minLength}`));
        }
        if (d.agingDays != null) {
          outputs.push(await s.exec(`terminal user password aging-time ${d.agingDays}`));
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
          outputs.push(wiz.transcript);
        }
        await s.exec("quit");
        const combined = outputs.join("\n---\n");
        const failed = /(failure|failed|invalid|error|denied)/i.test(combined);
        return { output: combined, success: !failed };
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

// ─────────────────────────── helpers ───────────────────────────

async function safeExec(s: OltSession, cmd: string): Promise<string> {
  try {
    return await s.exec(cmd);
  } catch (e) {
    return `(error running "${cmd}": ${e instanceof Error ? e.message : String(e)})`;
  }
}

export default router;
