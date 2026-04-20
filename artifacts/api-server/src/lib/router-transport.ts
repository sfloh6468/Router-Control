/**
 * Unified RouterOS transport layer.
 *
 * Supports four ways to talk to a MikroTik router:
 *
 *   - api / api-ssl : MikroTik binary API (8728 / 8729)  via routeros-client
 *   - rest / rest-tls : Webfig REST API   (80 / 443)     via fetch + Basic auth
 *   - ssh           : RouterOS SSH        (22)           via ssh2 (text exec)
 *
 * All four transports expose the same minimal "menu" surface so the route
 * handlers in mikrotik.ts / chat.ts can stay transport-agnostic:
 *
 *   adapter.menu(path).get(filter?)   // list
 *   adapter.menu(path).getOnly()      // first record (single-record menus)
 *   adapter.menu(path).add(props)     // create — returns { id }
 *   adapter.menu(path).update(props, id?)
 *   adapter.menu(path).remove(id)
 *   adapter.menu(path).enable(id)
 *   adapter.menu(path).disable(id)
 *
 *   adapter.exec(rawCommand)          // raw RouterOS line (SSH only)
 *   adapter.close()
 *
 * Field-name contract: every adapter returns records with camelCase keys and
 * `id` (no leading dot) — matching the convention routeros-client uses, so
 * existing dashboard code keeps working unchanged.
 */

import { RouterOSClient } from "routeros-client";
import { Client as SshClient } from "ssh2";
import * as https from "node:https";

export type Transport = "api" | "api-ssl" | "rest" | "rest-tls" | "ssh";

export interface RouterCreds {
  host: string;
  port?: number;
  username: string;
  password: string;
  transport?: Transport;
}

export interface MenuOps {
  get(filter?: Record<string, string>): Promise<Record<string, unknown>[]>;
  getOnly(): Promise<Record<string, unknown>>;
  add(props: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(props: Record<string, unknown>, id?: string | number): Promise<void>;
  remove(id: string | number): Promise<void>;
  enable(id: string | number): Promise<void>;
  disable(id: string | number): Promise<void>;
}

export interface RouterAdapter {
  transport: Transport;
  menu(path: string): MenuOps;
  /** Run a raw RouterOS CLI line (only meaningful over SSH). */
  exec(command: string): Promise<string>;
  close(): void;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers shared by REST + SSH adapters
// ────────────────────────────────────────────────────────────────────────────

function kebabToCamel(key: string): string {
  if (key.startsWith(".")) key = key.slice(1); // .id → id
  return key.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function normalizeRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    let val: unknown = v;
    if (typeof v === "string") {
      if (v === "true") val = true;
      else if (v === "false") val = false;
      else if (/^-?\d+$/.test(v)) val = Number(v);
    }
    out[kebabToCamel(k)] = val;
  }
  return out;
}

/** camelCase → kebab-case for outgoing prop names. */
function camelToKebab(key: string): string {
  return key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

function normalizeProps(props: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    out[camelToKebab(k)] = String(v);
  }
  return out;
}

export function defaultPortFor(transport: Transport): number {
  switch (transport) {
    case "api":      return 8728;
    case "api-ssl":  return 8729;
    case "rest":     return 80;
    case "rest-tls": return 443;
    case "ssh":      return 22;
  }
}

/** Infer transport from explicit field, or from the port number. */
export function resolveTransport(creds: RouterCreds): Transport {
  if (creds.transport) return creds.transport;
  const p = creds.port;
  if (p === 8728) return "api";
  if (p === 8729) return "api-ssl";
  if (p === 80) return "rest";
  if (p === 443) return "rest-tls";
  if (p === 22) return "ssh";
  return "api-ssl"; // historical default
}

// ────────────────────────────────────────────────────────────────────────────
// API adapter (binary 8728 / 8729) — wraps routeros-client
// ────────────────────────────────────────────────────────────────────────────

async function buildApiAdapter(creds: RouterCreds, transport: Transport): Promise<RouterAdapter> {
  const port = creds.port ?? defaultPortFor(transport);
  const useTls = transport === "api-ssl";
  const api = new RouterOSClient({
    host: creds.host,
    user: creds.username,
    password: creds.password,
    port,
    tls: useTls
      ? { rejectUnauthorized: false, ciphers: "ADH:@SECLEVEL=0" }
      : undefined,
    timeout: 15,
  });
  const client = await api.connect();
  return {
    transport,
    menu(path: string): MenuOps {
      const m = client.menu(path) as any;
      return {
        get: (filter) => m.get(filter) as Promise<Record<string, unknown>[]>,
        getOnly: () => m.getOnly() as Promise<Record<string, unknown>>,
        add: (props) => m.add(props) as Promise<Record<string, unknown>>,
        update: async (props, id) => {
          if (id !== undefined) await m.update(props, id);
          else await m.update(props);
        },
        remove: async (id) => { await m.remove(id); },
        enable: async (id) => { await m.enable(id); },
        disable: async (id) => { await m.disable(id); },
      };
    },
    exec: async () => {
      throw new Error("Raw command exec is only available over SSH transport.");
    },
    close: () => { try { api.close(); } catch { /* ignore */ } },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// REST adapter (Webfig) — RouterOS 7.1+
//   GET    /rest/<path>            → list
//   PUT    /rest/<path>            → add (body = json props)
//   PATCH  /rest/<path>/<id>       → update
//   DELETE /rest/<path>/<id>       → remove
//   POST   /rest/<path>/enable     → { ".id": id }
//   POST   /rest/<path>/disable    → { ".id": id }
// ────────────────────────────────────────────────────────────────────────────

async function buildRestAdapter(creds: RouterCreds, transport: Transport): Promise<RouterAdapter> {
  const port = creds.port ?? defaultPortFor(transport);
  const useTls = transport === "rest-tls";
  const proto = useTls ? "https" : "http";
  const baseUrl = `${proto}://${creds.host}:${port}/rest`;
  const auth = "Basic " + Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
  // Webfig HTTPS uses a self-signed cert by default — must skip verification.
  const httpsAgent = useTls ? new https.Agent({ rejectUnauthorized: false }) : undefined;

  async function call<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${path.startsWith("/") ? path : "/" + path}`;
    const init: RequestInit & { agent?: unknown } = {
      method,
      headers: {
        "Authorization": auth,
        "Accept": "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    // Build a diagnostic-rich error message that exposes server identity.
    function buildRestError(
      status: number,
      statusText: string,
      bodyText: string,
      headers: Record<string, string | undefined>,
    ): Error {
      let detail = bodyText.trim();
      try {
        const j = JSON.parse(bodyText);
        detail = (j.detail ?? j.message ?? j.error ?? bodyText).toString().trim();
      } catch { /* keep raw text */ }
      const server = headers["server"] || headers["Server"] || "unknown";
      const ctype = headers["content-type"] || headers["Content-Type"] || "unknown";
      const hint = looksLikeWrongServer(status, server, ctype, detail);
      const head = `REST ${method} ${path} → ${status} ${statusText}`.trim();
      const tail = `[server=${server}, content-type=${ctype}]`;
      return new Error(`${head} — ${detail || "(empty body)"} ${tail}${hint ? `\nHint: ${hint}` : ""}`);
    }

    // Fall back to node:https for HTTPS to honor rejectUnauthorized.
    if (useTls) {
      return await new Promise<T>((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          method,
          // RouterOS www-ssl with self-generated cert uses anonymous-DH
          // ciphers, which OpenSSL 3 disables by default. Same fix as
          // the binary API-SSL adapter.
          rejectUnauthorized: false,
          ciphers: "ADH:ALL:@SECLEVEL=0",
          minVersion: "TLSv1" as const,
          headers: init.headers as Record<string, string>,
        }, (resp) => {
          const chunks: Buffer[] = [];
          resp.on("data", (c) => chunks.push(c));
          resp.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf-8");
            const status = resp.statusCode ?? 0;
            if (status >= 400) {
              reject(buildRestError(
                status,
                resp.statusMessage || "",
                text,
                resp.headers as Record<string, string | undefined>,
              ));
              return;
            }
            try { resolve(text ? JSON.parse(text) as T : (undefined as T)); }
            catch { resolve(text as unknown as T); }
          });
        });
        req.on("error", reject);
        req.setTimeout(15000, () => { req.destroy(new Error("REST request timed out")); });
        if (body !== undefined) req.write(JSON.stringify(body));
        req.end();
      });
    }
    const resp = await fetch(url, init as RequestInit);
    if (!resp.ok) {
      const text = await resp.text();
      const headers: Record<string, string> = {};
      resp.headers.forEach((v, k) => { headers[k] = v; });
      throw buildRestError(resp.status, resp.statusText, text, headers);
    }
    const text = await resp.text();
    if (!text) return undefined as T;
    try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
  }

  // Spot common misconfigurations so the user knows what to fix.
  function looksLikeWrongServer(
    status: number,
    server: string,
    ctype: string,
    body: string,
  ): string | null {
    const s = (server || "").toLowerCase();
    const c = (ctype || "").toLowerCase();
    const b = (body || "").toLowerCase();
    if (status === 502 && (b.includes("bad gateway") || b.includes("502"))) {
      return "RouterOS plain-HTTP REST often returns 502 Bad Gateway. " +
             "Try REST/Webfig HTTPS instead (transport: rest-tls, default port 443; your router's www-ssl is on 4433).";
    }
    if (status === 404 && c.includes("text/html")) {
      return "The endpoint returned HTML, not JSON — the www service may not have REST enabled, " +
             "or RouterOS is older than 7.1. Try API-SSL on 8729 instead.";
    }
    if (s.includes("nginx") || s.includes("apache") || s.includes("cloudflare")) {
      return `The response came from "${server}" — that is not RouterOS. Something in front of your ` +
             "router (CDN, reverse proxy, ISP captive portal) is intercepting the request.";
    }
    if (status === 401) {
      return "Authentication failed. Check the username/password and that the user has the 'api' group permission.";
    }
    return null;
  }

  // Sanity-check the connection up front by fetching identity.
  // /rest/system/identity returns an object (single-record menu).
  await call("GET", "/system/identity");

  return {
    transport,
    menu(path: string): MenuOps {
      // Webfig REST paths use the same slashes as routeros-client paths
      // ("/system/resource", "/ip/address", etc).
      const restPath = path.startsWith("/") ? path : "/" + path;
      return {
        async get(filter) {
          let q = "";
          if (filter && Object.keys(filter).length > 0) {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(filter)) params.set(camelToKebab(k), v);
            q = "?" + params.toString();
          }
          const data = await call<unknown>("GET", restPath + q);
          if (Array.isArray(data)) return data.map((r) => normalizeRecord(r as Record<string, unknown>));
          if (data && typeof data === "object") return [normalizeRecord(data as Record<string, unknown>)];
          return [];
        },
        async getOnly() {
          const data = await call<unknown>("GET", restPath);
          if (Array.isArray(data)) return normalizeRecord((data[0] ?? {}) as Record<string, unknown>);
          return normalizeRecord((data ?? {}) as Record<string, unknown>);
        },
        async add(props) {
          const body = normalizeProps(props);
          const r = await call<Record<string, unknown>>("PUT", restPath, body);
          return r ? normalizeRecord(r) : {};
        },
        async update(props, id) {
          const body = normalizeProps(props);
          if (id === undefined) {
            // Update single-record menu (e.g. /ip/dns set ...) — REST uses POST /rest/<path>/set
            await call("POST", restPath + "/set", body);
            return;
          }
          await call("PATCH", restPath + "/" + encodeURIComponent(String(id)), body);
        },
        async remove(id) {
          await call("DELETE", restPath + "/" + encodeURIComponent(String(id)));
        },
        async enable(id) {
          await call("POST", restPath + "/enable", { ".id": String(id) });
        },
        async disable(id) {
          await call("POST", restPath + "/disable", { ".id": String(id) });
        },
      };
    },
    exec: async () => {
      throw new Error("Raw command exec is only available over SSH transport.");
    },
    close: () => { /* stateless */ },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// SSH adapter — runs each command in its own short-lived exec channel.
//
// For structured menu queries we use `<path> print as-value without-paging`,
// which RouterOS formats as one record per line, semicolon-separated:
//
//     .id=*1;name=ether1;type=ether;mtu=1500
//     .id=*2;name=ether2;type=ether;mtu=1500
//
// For mutations we build raw "<path> add k=v ..." / "set" / "remove" / etc.
// For raw exec() we just send the command verbatim.
// ────────────────────────────────────────────────────────────────────────────

interface SshSession {
  client: SshClient;
  exec(cmd: string): Promise<string>;
  end(): void;
}

async function openSsh(creds: RouterCreds, port: number): Promise<SshSession> {
  return await new Promise<SshSession>((resolve, reject) => {
    const client = new SshClient();
    let settled = false;
    const fail = (err: Error) => {
      if (!settled) { settled = true; try { client.end(); } catch { /* ignore */ } reject(err); }
    };
    client.on("ready", () => {
      settled = true;
      resolve({
        client,
        exec(cmd: string) {
          return new Promise<string>((res, rej) => {
            client.exec(cmd, (err, stream) => {
              if (err) return rej(err);
              let stdout = "";
              let stderr = "";
              stream.on("data", (d: Buffer) => { stdout += d.toString("utf-8"); });
              stream.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
              stream.on("close", (code: number) => {
                if (code !== 0 && stderr) return rej(new Error(stderr.trim() || `exit ${code}`));
                res(stdout);
              });
            });
          });
        },
        end() { try { client.end(); } catch { /* ignore */ } },
      });
    });
    client.on("error", fail);
    client.connect({
      host: creds.host,
      port,
      // RouterOS SSH user suffix "+ct" disables color output and pagination,
      // making the streams safe to parse.
      username: creds.username + "+ct",
      password: creds.password,
      readyTimeout: 15000,
      // RouterOS often uses older KEX/host-key algorithms; allow a wide range.
      algorithms: {
        kex: [
          "curve25519-sha256",
          "curve25519-sha256@libssh.org",
          "diffie-hellman-group14-sha256",
          "diffie-hellman-group14-sha1",
          "diffie-hellman-group-exchange-sha256",
          "diffie-hellman-group1-sha1",
        ] as any,
        serverHostKey: [
          "ssh-ed25519",
          "rsa-sha2-512",
          "rsa-sha2-256",
          "ssh-rsa",
        ] as any,
        cipher: [
          "aes128-ctr", "aes192-ctr", "aes256-ctr",
          "aes128-gcm", "aes256-gcm",
          "aes128-cbc",
        ] as any,
      },
    });
  });
}

/** Parse one "as-value" line: ".id=*1;name=ether1;..." → record.
 *  Respects double-quoted values and `\"` / `\\` escapes inside them. */
function parseAsValueLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(";")) return null;
  const out: Record<string, unknown> = {};
  // First split on top-level `;`, respecting quoted values and `\"` escapes.
  const parts: string[] = [];
  let buf = "";
  let inQuote = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "\\" && inQuote && i + 1 < trimmed.length) {
      // copy the escape sequence verbatim, decoded
      const next = trimmed[i + 1];
      buf += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : next;
      i++;
      continue;
    }
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === ";" && !inQuote) { parts.push(buf); buf = ""; continue; }
    buf += c;
  }
  if (buf.length) parts.push(buf);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1);
    out[k] = v;
  }
  if (Object.keys(out).length === 0) return null;
  return normalizeRecord(out);
}

/** Convert routeros-client style path "/ip/address" → CLI form "/ip address". */
function cliPath(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return "/" + p.replace(/\//g, " ");
}

/** Quote a RouterOS CLI value safely. Always quote and escape `\` and `"`,
 *  plus newlines/CRs that would terminate the command. */
function quoteRosValue(raw: string): string {
  // Reject NUL outright; RouterOS will misinterpret embedded NULs.
  if (raw.indexOf("\0") !== -1) {
    throw new Error("Value contains NUL byte");
  }
  const escaped = raw
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
  return `"${escaped}"`;
}

/** Validate a RouterOS internal id (e.g. `*1F`) or a small numeric index. */
function validateRosId(id: string | number): string {
  const s = String(id);
  if (!/^(\*[0-9A-Fa-f]+|\d+)$/.test(s)) {
    throw new Error(`Invalid RouterOS id: ${JSON.stringify(s)}`);
  }
  return s;
}

function buildKvArgs(props: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    const key = camelToKebab(k);
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(key)) {
      throw new Error(`Invalid RouterOS property name: ${JSON.stringify(key)}`);
    }
    parts.push(`${key}=${quoteRosValue(String(v))}`);
  }
  return parts.join(" ");
}

async function buildSshAdapter(creds: RouterCreds, transport: Transport): Promise<RouterAdapter> {
  const port = creds.port ?? defaultPortFor(transport);
  const session = await openSsh(creds, port);
  // Sanity-check: identity print.
  await session.exec("/system identity print without-paging");

  return {
    transport,
    menu(path: string): MenuOps {
      const cli = cliPath(path);
      return {
        async get(filter) {
          let cmd = `${cli} print as-value without-paging`;
          if (filter && Object.keys(filter).length > 0) {
            const wherePairs: string[] = [];
            for (const [k, v] of Object.entries(filter)) {
              const key = camelToKebab(k);
              if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(key)) {
                throw new Error(`Invalid filter key: ${JSON.stringify(key)}`);
              }
              wherePairs.push(`${key}=${quoteRosValue(String(v))}`);
            }
            cmd = `${cli} print as-value without-paging where ${wherePairs.join(" ")}`;
          }
          const out = await session.exec(cmd);
          const records: Record<string, unknown>[] = [];
          for (const line of out.split(/\r?\n/)) {
            const rec = parseAsValueLine(line);
            if (rec) records.push(rec);
          }
          return records;
        },
        async getOnly() {
          const out = await session.exec(`${cli} print as-value without-paging`);
          for (const line of out.split(/\r?\n/)) {
            const rec = parseAsValueLine(line);
            if (rec) return rec;
          }
          return {};
        },
        async add(props) {
          const args = buildKvArgs(props);
          const out = await session.exec(`${cli} add ${args}`);
          // RouterOS prints the new .id (e.g. "*1F"). Capture if present.
          const m = out.match(/\*[0-9A-Fa-f]+/);
          return m ? { id: m[0] } : {};
        },
        async update(props, id) {
          const args = buildKvArgs(props);
          if (id === undefined) {
            await session.exec(`${cli} set ${args}`);
            return;
          }
          await session.exec(`${cli} set ${validateRosId(id)} ${args}`);
        },
        async remove(id)  { await session.exec(`${cli} remove ${validateRosId(id)}`);  },
        async enable(id)  { await session.exec(`${cli} enable ${validateRosId(id)}`);  },
        async disable(id) { await session.exec(`${cli} disable ${validateRosId(id)}`); },
      };
    },
    async exec(command: string): Promise<string> {
      return await session.exec(command);
    },
    close: () => session.end(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public factory + helper
// ────────────────────────────────────────────────────────────────────────────

export async function connectRouter(creds: RouterCreds): Promise<RouterAdapter> {
  const transport = resolveTransport(creds);
  switch (transport) {
    case "api":
    case "api-ssl":
      return await buildApiAdapter(creds, transport);
    case "rest":
    case "rest-tls":
      return await buildRestAdapter(creds, transport);
    case "ssh":
      return await buildSshAdapter(creds, transport);
  }
}

/**
 * Open a transport, run `fn`, always close. Mirrors the existing `withClient`
 * helper but transport-aware.
 */
export async function withRouter<T>(
  creds: RouterCreds,
  fn: (adapter: RouterAdapter) => Promise<T>,
): Promise<T> {
  const adapter = await connectRouter(creds);
  try {
    const result = await fn(adapter);
    adapter.close();
    return result;
  } catch (err) {
    adapter.close();
    throw err;
  }
}
