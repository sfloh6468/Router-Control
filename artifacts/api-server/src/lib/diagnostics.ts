/**
 * Sandbox-side network diagnostics. These run from THIS server's vantage
 * point on the public internet (not from the user's router), which gives
 * the AI assistant a second perspective during troubleshooting:
 *
 *   - Asymmetric routing: router can reach X but a public host can't.
 *   - BGP advertisement leakage: who else can see this prefix?
 *   - DNS / RDAP / WHOIS / ASN lookups for any IP or domain.
 *
 * All probes are pure-Node (no shell, no privileged sockets) so they work
 * inside the Replit container without root.
 */

import * as net from "node:net";
import * as tls from "node:tls";
import * as dns from "node:dns/promises";
import * as https from "node:https";
import * as http from "node:http";

// ────────────────────────────────────────────────────────────────────────
// TCP port probe — "telnet" without shelling out
// ────────────────────────────────────────────────────────────────────────

export interface TcpProbeResult {
  host: string;
  port: number;
  ok: boolean;
  latencyMs?: number;
  error?: string;
  remoteAddress?: string;
}

export async function tcpProbe(
  host: string,
  port: number,
  timeoutMs = 5000,
): Promise<TcpProbeResult> {
  return await new Promise<TcpProbeResult>((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const finish = (r: TcpProbeResult) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(r);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish({
        host, port, ok: true,
        latencyMs: Date.now() - start,
        remoteAddress: socket.remoteAddress ?? undefined,
      });
    });
    socket.once("timeout", () => finish({ host, port, ok: false, error: "timeout" }));
    socket.once("error", (err) => finish({ host, port, ok: false, error: err.message }));
    socket.connect(port, host);
  });
}

/** TCP-ping: probe a port N times and return min/avg/max/loss stats. */
export async function tcpPing(
  host: string,
  port: number,
  count = 4,
  timeoutMs = 3000,
): Promise<{
  host: string;
  port: number;
  sent: number;
  received: number;
  lossPct: number;
  minMs?: number;
  avgMs?: number;
  maxMs?: number;
  samples: TcpProbeResult[];
}> {
  const samples: TcpProbeResult[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(await tcpProbe(host, port, timeoutMs));
    if (i < count - 1) await new Promise((r) => setTimeout(r, 250));
  }
  const okSamples = samples.filter((s) => s.ok && typeof s.latencyMs === "number");
  const latencies = okSamples.map((s) => s.latencyMs!);
  return {
    host, port,
    sent: count,
    received: okSamples.length,
    lossPct: Math.round(((count - okSamples.length) / count) * 100),
    minMs: latencies.length ? Math.min(...latencies) : undefined,
    avgMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : undefined,
    maxMs: latencies.length ? Math.max(...latencies) : undefined,
    samples,
  };
}

// ────────────────────────────────────────────────────────────────────────
// DNS — forward & reverse, all common record types
// ────────────────────────────────────────────────────────────────────────

const DNS_RECORD_TYPES = ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "CAA", "SRV", "PTR"] as const;
export type DnsRecordType = typeof DNS_RECORD_TYPES[number];

export async function dnsLookup(
  host: string,
  types: DnsRecordType[] = ["A", "AAAA"],
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { host };
  for (const t of types) {
    try {
      switch (t) {
        case "A":     out.A     = await dns.resolve4(host); break;
        case "AAAA":  out.AAAA  = await dns.resolve6(host); break;
        case "MX":    out.MX    = await dns.resolveMx(host); break;
        case "TXT":   out.TXT   = await dns.resolveTxt(host); break;
        case "NS":    out.NS    = await dns.resolveNs(host); break;
        case "CNAME": out.CNAME = await dns.resolveCname(host); break;
        case "SOA":   out.SOA   = await dns.resolveSoa(host); break;
        case "CAA":   out.CAA   = await dns.resolveCaa(host); break;
        case "SRV":   out.SRV   = await dns.resolveSrv(host); break;
        case "PTR":   out.PTR   = await dns.resolvePtr(host); break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      out[t] = `error: ${msg}`;
    }
  }
  return out;
}

export async function reverseDns(ip: string): Promise<string[]> {
  try {
    return await dns.reverse(ip);
  } catch (err) {
    throw new Error(`reverse-DNS failed for ${ip}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────
// HTTP / HTTPS probe — status, latency, headers, redirect chain, TLS info
// ────────────────────────────────────────────────────────────────────────

export interface HttpProbeResult {
  url: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  latencyMs?: number;
  headers?: Record<string, string>;
  finalUrl?: string;
  redirectChain?: string[];
  tls?: {
    protocol?: string;
    cipher?: string;
    issuer?: string;
    subject?: string;
    validTo?: string;
    subjectAltNames?: string[];
  };
  bodyPreview?: string;
  error?: string;
}

export async function httpProbe(
  url: string,
  opts: { method?: string; followRedirects?: boolean; timeoutMs?: number; insecureTls?: boolean } = {},
): Promise<HttpProbeResult> {
  const method = (opts.method ?? "GET").toUpperCase();
  const followRedirects = opts.followRedirects ?? true;
  const timeoutMs = opts.timeoutMs ?? 10000;
  const redirectChain: string[] = [];
  let currentUrl = url;
  let hops = 0;

  while (true) {
    hops++;
    if (hops > 8) return { url, ok: false, error: "too many redirects", redirectChain };

    const u = new URL(currentUrl);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;
    const start = Date.now();

    const result: HttpProbeResult = await new Promise((resolve) => {
      const req = lib.request({
        method,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        headers: { "User-Agent": "MikroTik-Manager-Diagnostics/1.0", "Accept": "*/*" },
        rejectUnauthorized: !opts.insecureTls,
        ...(isHttps ? { ciphers: "ALL:@SECLEVEL=0" } : {}),
      } as any, (resp) => {
        const chunks: Buffer[] = [];
        let total = 0;
        resp.on("data", (c) => {
          if (total < 4096) { chunks.push(c); total += c.length; }
        });
        resp.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(resp.headers)) {
            headers[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
          }
          let tlsInfo: HttpProbeResult["tls"] | undefined;
          const sock = (req as any).socket as tls.TLSSocket | undefined;
          if (isHttps && sock && typeof sock.getPeerCertificate === "function") {
            try {
              const cert = sock.getPeerCertificate();
              tlsInfo = {
                protocol: sock.getProtocol() ?? undefined,
                cipher: sock.getCipher()?.name,
                issuer: cert?.issuer ? Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(", ") : undefined,
                subject: cert?.subject ? Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(", ") : undefined,
                validTo: cert?.valid_to,
                subjectAltNames: cert?.subjectaltname ? cert.subjectaltname.split(", ") : undefined,
              };
            } catch { /* ignore */ }
          }
          resolve({
            url: currentUrl,
            ok: (resp.statusCode ?? 0) < 400,
            status: resp.statusCode,
            statusText: resp.statusMessage,
            latencyMs: Date.now() - start,
            headers,
            tls: tlsInfo,
            bodyPreview: Buffer.concat(chunks).toString("utf-8").slice(0, 1024),
          });
        });
      });
      req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
      req.on("error", (err) => resolve({ url: currentUrl, ok: false, error: err.message, latencyMs: Date.now() - start }));
      req.end();
    });

    redirectChain.push(currentUrl);

    if (followRedirects && result.status && result.status >= 300 && result.status < 400 && result.headers?.location) {
      currentUrl = new URL(result.headers.location, currentUrl).toString();
      continue;
    }

    return { ...result, finalUrl: currentUrl, redirectChain };
  }
}

// ────────────────────────────────────────────────────────────────────────
// IP intel: ASN lookup (Team Cymru) and RDAP (modern WHOIS)
// ────────────────────────────────────────────────────────────────────────

/**
 * Resolve an IPv4 address to its origin ASN via Team Cymru's free DNS
 * service: e.g. for 1.1.1.1 we query "1.1.1.1.origin.asn.cymru.com TXT".
 *
 * Returns { asn, prefix, country, registry, asName } when available.
 */
export async function asnLookup(ip: string): Promise<{
  ip: string;
  asn?: number;
  prefix?: string;
  country?: string;
  registry?: string;
  asName?: string;
  raw?: string;
}> {
  const isV6 = ip.includes(":");
  if (isV6) {
    // IPv6 cymru zone is origin6.asn.cymru.com with reversed nibbles.
    // Skip for v6 in v1 — return a stub.
    return { ip, raw: "IPv6 ASN lookup not implemented" };
  }
  const reversed = ip.split(".").reverse().join(".");
  const txts = await dns.resolveTxt(`${reversed}.origin.asn.cymru.com`).catch(() => []);
  if (!txts.length) return { ip, raw: "no ASN record" };
  // Cymru format: "ASN | Prefix | Country | Registry | Allocated"
  const line = txts[0].join("");
  const parts = line.split("|").map((s) => s.trim());
  const asn = parseInt(parts[0] ?? "", 10);
  let asName: string | undefined;
  if (!Number.isNaN(asn)) {
    const asTxts = await dns.resolveTxt(`AS${asn}.asn.cymru.com`).catch(() => []);
    if (asTxts.length) {
      const asLine = asTxts[0].join("");
      // "ASN | Country | Registry | Allocated | AS Name"
      const asParts = asLine.split("|").map((s) => s.trim());
      asName = asParts[4];
    }
  }
  return {
    ip,
    asn: Number.isNaN(asn) ? undefined : asn,
    prefix: parts[1],
    country: parts[2],
    registry: parts[3],
    asName,
    raw: line,
  };
}

/**
 * Modern WHOIS via RDAP. ARIN's bootstrap server redirects to the right
 * RIR (RIPE, APNIC, LACNIC, AFRINIC) for the IP automatically.
 */
export async function rdapIp(ip: string): Promise<Record<string, unknown>> {
  const r = await httpProbe(`https://rdap.arin.net/registry/ip/${encodeURIComponent(ip)}`, {
    followRedirects: true,
    timeoutMs: 8000,
  });
  if (!r.ok) throw new Error(`RDAP request failed: ${r.error || `${r.status} ${r.statusText}`}`);
  try {
    const j = JSON.parse(r.bodyPreview ?? "{}");
    // Trim down to the most useful fields for the AI.
    return {
      handle: j.handle,
      name: j.name,
      type: j.type,
      country: j.country,
      startAddress: j.startAddress,
      endAddress: j.endAddress,
      cidr0_cidrs: j.cidr0_cidrs,
      entities: Array.isArray(j.entities)
        ? j.entities.map((e: any) => ({
            handle: e.handle,
            roles: e.roles,
            vcardArray: e.vcardArray,
          })).slice(0, 5)
        : undefined,
      remarks: j.remarks,
      events: j.events,
      links: Array.isArray(j.links) ? j.links.map((l: any) => l.href) : undefined,
    };
  } catch {
    return { raw: r.bodyPreview };
  }
}

export async function rdapDomain(domain: string): Promise<Record<string, unknown>> {
  // rdap.org dispatches to the right registry based on TLD.
  const r = await httpProbe(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    followRedirects: true,
    timeoutMs: 8000,
  });
  if (!r.ok) throw new Error(`RDAP request failed: ${r.error || `${r.status} ${r.statusText}`}`);
  try {
    const j = JSON.parse(r.bodyPreview ?? "{}");
    return {
      handle: j.handle,
      ldhName: j.ldhName,
      status: j.status,
      events: j.events,
      nameservers: Array.isArray(j.nameservers)
        ? j.nameservers.map((n: any) => n.ldhName)
        : undefined,
      entities: Array.isArray(j.entities)
        ? j.entities.map((e: any) => ({ handle: e.handle, roles: e.roles })).slice(0, 5)
        : undefined,
    };
  } catch {
    return { raw: r.bodyPreview };
  }
}

// ────────────────────────────────────────────────────────────────────────
// What does this sandbox look like to the internet?
// ────────────────────────────────────────────────────────────────────────

export async function sandboxPublicInfo(): Promise<{
  publicIp?: string;
  asn?: number;
  asName?: string;
  country?: string;
  hostname?: string;
}> {
  // Use Cloudflare's trace endpoint — small, fast, no API key.
  const r = await httpProbe("https://www.cloudflare.com/cdn-cgi/trace", { timeoutMs: 5000 });
  const text = r.bodyPreview ?? "";
  const map: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) map[line.slice(0, eq)] = line.slice(eq + 1);
  }
  const ip = map.ip;
  if (!ip) return {};
  const asn = await asnLookup(ip).catch(() => ({} as any));
  let hostname: string | undefined;
  try { const r2 = await dns.reverse(ip); hostname = r2[0]; } catch { /* ignore */ }
  return {
    publicIp: ip,
    asn: asn.asn,
    asName: asn.asName,
    country: asn.country,
    hostname,
  };
}
