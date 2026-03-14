import { Router, type IRouter } from "express";
import axios, { AxiosError } from "axios";
import https from "https";
import crypto from "crypto";
import {
  TestConnectionBody,
  GetSystemResourceBody,
  GetInterfacesBody,
  GetIpAddressesBody,
  GetFirewallRulesBody,
  GetDhcpLeasesBody,
  GetWirelessClientsBody,
  RunCommandBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  minVersion: "TLSv1" as "TLSv1",
  ciphers: [
    "TLS_AES_128_GCM_SHA256",
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256",
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES128-SHA256",
    "ECDHE-RSA-AES256-SHA384",
    "ECDHE-RSA-AES128-SHA",
    "ECDHE-RSA-AES256-SHA",
    "AES128-GCM-SHA256",
    "AES256-GCM-SHA384",
    "AES128-SHA256",
    "AES256-SHA256",
    "AES128-SHA",
    "AES256-SHA",
    "DES-CBC3-SHA",
  ].join(":"),
  secureOptions:
    crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
    crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});

const HTTP_PORTS = [80, 8080, 8000, 8088, 58080, 58000];

function mkAxios(host: string, port: number | undefined, username: string, password: string) {
  const portNum = port ?? 80;
  const protocol = HTTP_PORTS.includes(portNum) ? "http" : "https";
  const baseURL = `${protocol}://${host}:${portNum}/rest`;
  return axios.create({
    baseURL,
    auth: { username, password },
    httpsAgent,
    timeout: 10000,
    headers: { "Content-Type": "application/json" },
  });
}

function axiosError(err: unknown): string {
  if (err instanceof AxiosError) {
    if (err.response) {
      const detail = err.response.data?.detail || err.response.data?.message || JSON.stringify(err.response.data);
      return `HTTP ${err.response.status}: ${detail}`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function normalizeKey(key: string): string {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^\./, "");
}

function normalizeObject(raw: Record<string, unknown>): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    result[normalizeKey(k)] = v == null ? null : String(v);
  }
  return result;
}

router.post("/mikrotik/connect", async (req, res): Promise<void> => {
  const parsed = TestConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  const client = mkAxios(host, port, username, password);
  try {
    const resp = await client.get("/system/resource");
    const data = resp.data as Record<string, unknown>;
    res.json({
      success: true,
      message: "Connected successfully",
      routerOs: data?.version ? String(data.version) : null,
      routerBoard: data?.["board-name"] ? String(data["board-name"]) : null,
    });
  } catch (err) {
    res.status(400).json({ error: axiosError(err) });
  }
});

router.post("/mikrotik/system", async (req, res): Promise<void> => {
  const parsed = GetSystemResourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  const client = mkAxios(host, port, username, password);
  try {
    const resp = await client.get("/system/resource");
    const d = resp.data as Record<string, unknown>;
    res.json({
      uptime: d["uptime"] ? String(d["uptime"]) : null,
      version: d["version"] ? String(d["version"]) : null,
      buildTime: d["build-time"] ? String(d["build-time"]) : null,
      boardName: d["board-name"] ? String(d["board-name"]) : null,
      platform: d["platform"] ? String(d["platform"]) : null,
      cpuLoad: d["cpu-load"] !== undefined ? String(d["cpu-load"]) : null,
      freeMemory: d["free-memory"] ? String(d["free-memory"]) : null,
      totalMemory: d["total-memory"] ? String(d["total-memory"]) : null,
      freeHddSpace: d["free-hdd-space"] ? String(d["free-hdd-space"]) : null,
      totalHddSpace: d["total-hdd-space"] ? String(d["total-hdd-space"]) : null,
      cpuCount: d["cpu-count"] ? String(d["cpu-count"]) : null,
      cpuFrequency: d["cpu-frequency"] ? String(d["cpu-frequency"]) : null,
      architecture: d["architecture-name"] ? String(d["architecture-name"]) : null,
    });
  } catch (err) {
    res.status(400).json({ error: axiosError(err) });
  }
});

router.post("/mikrotik/interfaces", async (req, res): Promise<void> => {
  const parsed = GetInterfacesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  const client = mkAxios(host, port, username, password);
  try {
    const resp = await client.get("/interface");
    const items = Array.isArray(resp.data) ? resp.data : [resp.data];
    res.json(
      items.map((d: Record<string, unknown>) => ({
        id: d[".id"] ? String(d[".id"]) : null,
        name: d["name"] ? String(d["name"]) : null,
        type: d["type"] ? String(d["type"]) : null,
        mtu: d["mtu"] ? String(d["mtu"]) : null,
        macAddress: d["mac-address"] ? String(d["mac-address"]) : null,
        running: d["running"] !== undefined ? String(d["running"]) : null,
        disabled: d["disabled"] !== undefined ? String(d["disabled"]) : null,
        comment: d["comment"] ? String(d["comment"]) : null,
      }))
    );
  } catch (err) {
    res.status(400).json({ error: axiosError(err) });
  }
});

router.post("/mikrotik/ip/addresses", async (req, res): Promise<void> => {
  const parsed = GetIpAddressesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  const client = mkAxios(host, port, username, password);
  try {
    const resp = await client.get("/ip/address");
    const items = Array.isArray(resp.data) ? resp.data : [resp.data];
    res.json(
      items.map((d: Record<string, unknown>) => ({
        id: d[".id"] ? String(d[".id"]) : null,
        address: d["address"] ? String(d["address"]) : null,
        network: d["network"] ? String(d["network"]) : null,
        interface: d["interface"] ? String(d["interface"]) : null,
        disabled: d["disabled"] !== undefined ? String(d["disabled"]) : null,
        dynamic: d["dynamic"] !== undefined ? String(d["dynamic"]) : null,
        comment: d["comment"] ? String(d["comment"]) : null,
      }))
    );
  } catch (err) {
    res.status(400).json({ error: axiosError(err) });
  }
});

router.post("/mikrotik/firewall/rules", async (req, res): Promise<void> => {
  const parsed = GetFirewallRulesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  const client = mkAxios(host, port, username, password);
  try {
    const resp = await client.get("/ip/firewall/filter");
    const items = Array.isArray(resp.data) ? resp.data : [resp.data];
    res.json(
      items.map((d: Record<string, unknown>) => ({
        id: d[".id"] ? String(d[".id"]) : null,
        chain: d["chain"] ? String(d["chain"]) : null,
        action: d["action"] ? String(d["action"]) : null,
        protocol: d["protocol"] ? String(d["protocol"]) : null,
        srcAddress: d["src-address"] ? String(d["src-address"]) : null,
        dstAddress: d["dst-address"] ? String(d["dst-address"]) : null,
        dstPort: d["dst-port"] ? String(d["dst-port"]) : null,
        inInterface: d["in-interface"] ? String(d["in-interface"]) : null,
        outInterface: d["out-interface"] ? String(d["out-interface"]) : null,
        disabled: d["disabled"] !== undefined ? String(d["disabled"]) : null,
        comment: d["comment"] ? String(d["comment"]) : null,
      }))
    );
  } catch (err) {
    res.status(400).json({ error: axiosError(err) });
  }
});

router.post("/mikrotik/dhcp/leases", async (req, res): Promise<void> => {
  const parsed = GetDhcpLeasesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  const client = mkAxios(host, port, username, password);
  try {
    const resp = await client.get("/ip/dhcp-server/lease");
    const items = Array.isArray(resp.data) ? resp.data : [resp.data];
    res.json(
      items.map((d: Record<string, unknown>) => ({
        id: d[".id"] ? String(d[".id"]) : null,
        address: d["address"] ? String(d["address"]) : null,
        macAddress: d["mac-address"] ? String(d["mac-address"]) : null,
        hostname: d["host-name"] ? String(d["host-name"]) : null,
        status: d["status"] ? String(d["status"]) : null,
        expiresAfter: d["expires-after"] ? String(d["expires-after"]) : null,
        server: d["server"] ? String(d["server"]) : null,
        comment: d["comment"] ? String(d["comment"]) : null,
      }))
    );
  } catch (err) {
    res.status(400).json({ error: axiosError(err) });
  }
});

router.post("/mikrotik/wireless/clients", async (req, res): Promise<void> => {
  const parsed = GetWirelessClientsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  const client = mkAxios(host, port, username, password);
  try {
    const resp = await client.get("/interface/wireless/registration-table");
    const items = Array.isArray(resp.data) ? resp.data : [resp.data];
    res.json(
      items.map((d: Record<string, unknown>) => ({
        id: d[".id"] ? String(d[".id"]) : null,
        interface: d["interface"] ? String(d["interface"]) : null,
        macAddress: d["mac-address"] ? String(d["mac-address"]) : null,
        uptime: d["uptime"] ? String(d["uptime"]) : null,
        signalStrength: d["signal-strength"] ? String(d["signal-strength"]) : null,
        txRate: d["tx-rate"] ? String(d["tx-rate"]) : null,
        rxRate: d["rx-rate"] ? String(d["rx-rate"]) : null,
        ssid: d["ssid"] ? String(d["ssid"]) : null,
      }))
    );
  } catch (err) {
    res.status(400).json({ error: axiosError(err) });
  }
});

router.post("/mikrotik/command", async (req, res): Promise<void> => {
  const parsed = RunCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password, command } = parsed.data;
  const client = mkAxios(host, port, username, password);

  try {
    const trimmed = command.trim();
    const restPath = trimmed
      .replace(/^\//, "")
      .replace(/\s+print.*$/, "")
      .replace(/\s+.*$/, "");

    const resp = await client.get(`/${restPath}`);
    const data = resp.data;
    const outputText = JSON.stringify(data, null, 2);
    res.json({ output: outputText, success: true });
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      res.json({
        output: `Error: HTTP ${err.response.status} - ${JSON.stringify(err.response.data)}`,
        success: false,
      });
    } else {
      res.json({ output: `Error: ${axiosError(err)}`, success: false });
    }
  }
});

export default router;
