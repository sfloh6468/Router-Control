import { Router, type IRouter } from "express";
import { RouterOSClient } from "routeros-client";
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

const API_SSL_PORTS = [8729, 8728 + 1];

function makeClient(host: string, port: number | undefined, username: string, password: string) {
  const portNum = port ?? 8728;
  const useTls = API_SSL_PORTS.includes(portNum);
  return new RouterOSClient({
    host,
    user: username,
    password,
    port: portNum,
    tls: useTls ? {
      rejectUnauthorized: false,
      // MikroTik API SSL uses ADH (Anonymous Diffie-Hellman) ciphers
      // which are disabled in OpenSSL 3 by default — must allow them explicitly
      ciphers: "ADH:@SECLEVEL=0",
    } : undefined,
    timeout: 10,
  });
}

async function withClient<T>(
  host: string,
  port: number | undefined,
  username: string,
  password: string,
  fn: (client: ReturnType<RouterOSClient["connect"]> extends Promise<infer R> ? R : never) => Promise<T>
): Promise<T> {
  const api = makeClient(host, port, username, password);
  let client: Awaited<ReturnType<RouterOSClient["connect"]>>;
  try {
    client = await api.connect();
  } catch (err) {
    throw err;
  }
  try {
    const result = await fn(client);
    api.close();
    return result;
  } catch (err) {
    api.close();
    throw err;
  }
}

function str(val: unknown): string | null {
  if (val == null) return null;
  return String(val);
}

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    console.error("[mikrotik] Error:", err.message, err.stack);
    return err.message;
  }
  const s = String(err);
  console.error("[mikrotik] Error:", s);
  return s;
}

router.post("/mikrotik/connect", async (req, res): Promise<void> => {
  const parsed = TestConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  try {
    const result = await withClient(host, port, username, password, async (client) => {
      const data = await client.menu("/system/resource").getOnly();
      return data;
    });
    res.json({
      success: true,
      message: "Connected successfully",
      routerOs: str((result as Record<string, unknown>)["version"]),
      routerBoard: str((result as Record<string, unknown>)["board-name"]),
    });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

router.post("/mikrotik/system", async (req, res): Promise<void> => {
  const parsed = GetSystemResourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  try {
    const d = await withClient(host, port, username, password, async (client) => {
      return client.menu("/system/resource").getOnly() as Promise<Record<string, unknown>>;
    });
    res.json({
      uptime: str(d["uptime"]),
      version: str(d["version"]),
      buildTime: str(d["build-time"]),
      boardName: str(d["board-name"]),
      platform: str(d["platform"]),
      cpuLoad: str(d["cpu-load"]),
      freeMemory: str(d["free-memory"]),
      totalMemory: str(d["total-memory"]),
      freeHddSpace: str(d["free-hdd-space"]),
      totalHddSpace: str(d["total-hdd-space"]),
      cpuCount: str(d["cpu-count"]),
      cpuFrequency: str(d["cpu-frequency"]),
      architecture: str(d["architecture-name"]),
    });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

router.post("/mikrotik/interfaces", async (req, res): Promise<void> => {
  const parsed = GetInterfacesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  try {
    const items = await withClient(host, port, username, password, async (client) => {
      return client.menu("/interface").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d[".id"]),
        name: str(d["name"]),
        type: str(d["type"]),
        mtu: str(d["mtu"]),
        macAddress: str(d["mac-address"]),
        running: str(d["running"]),
        disabled: str(d["disabled"]),
        comment: str(d["comment"]),
      }))
    );
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

router.post("/mikrotik/ip/addresses", async (req, res): Promise<void> => {
  const parsed = GetIpAddressesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  try {
    const items = await withClient(host, port, username, password, async (client) => {
      return client.menu("/ip/address").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d[".id"]),
        address: str(d["address"]),
        network: str(d["network"]),
        interface: str(d["interface"]),
        disabled: str(d["disabled"]),
        dynamic: str(d["dynamic"]),
        comment: str(d["comment"]),
      }))
    );
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

router.post("/mikrotik/firewall/rules", async (req, res): Promise<void> => {
  const parsed = GetFirewallRulesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  try {
    const items = await withClient(host, port, username, password, async (client) => {
      return client.menu("/ip/firewall/filter").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d[".id"]),
        chain: str(d["chain"]),
        action: str(d["action"]),
        protocol: str(d["protocol"]),
        srcAddress: str(d["src-address"]),
        dstAddress: str(d["dst-address"]),
        dstPort: str(d["dst-port"]),
        inInterface: str(d["in-interface"]),
        outInterface: str(d["out-interface"]),
        disabled: str(d["disabled"]),
        comment: str(d["comment"]),
      }))
    );
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

router.post("/mikrotik/dhcp/leases", async (req, res): Promise<void> => {
  const parsed = GetDhcpLeasesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  try {
    const items = await withClient(host, port, username, password, async (client) => {
      return client.menu("/ip/dhcp-server/lease").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d[".id"]),
        address: str(d["address"]),
        macAddress: str(d["mac-address"]),
        hostname: str(d["host-name"]),
        status: str(d["status"]),
        expiresAfter: str(d["expires-after"]),
        server: str(d["server"]),
        comment: str(d["comment"]),
      }))
    );
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

router.post("/mikrotik/wireless/clients", async (req, res): Promise<void> => {
  const parsed = GetWirelessClientsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password } = parsed.data;
  try {
    const items = await withClient(host, port, username, password, async (client) => {
      return client.menu("/interface/wireless/registration-table").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d[".id"]),
        interface: str(d["interface"]),
        macAddress: str(d["mac-address"]),
        uptime: str(d["uptime"]),
        signalStrength: str(d["signal-strength"]),
        txRate: str(d["tx-rate"]),
        rxRate: str(d["rx-rate"]),
        ssid: str(d["ssid"]),
      }))
    );
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

router.post("/mikrotik/command", async (req, res): Promise<void> => {
  const parsed = RunCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password, command } = parsed.data;
  try {
    const result = await withClient(host, port, username, password, async (client) => {
      const trimmed = command.trim().replace(/\s+/g, " ");
      const parts = trimmed.split(" ");
      const menuPath = parts[0];
      const subCmd = parts[1] ?? "print";
      const menu = client.menu(menuPath);

      if (subCmd === "print" || subCmd === "get") {
        try {
          const data = await menu.get();
          return JSON.stringify(data, null, 2);
        } catch {
          const data = await menu.getOnly();
          return JSON.stringify(data, null, 2);
        }
      }

      return `Command "${command}" executed. Use format: /path/to/menu print`;
    });
    res.json({ output: result as string, success: true });
  } catch (err) {
    res.json({ output: `Error: ${errMsg(err)}`, success: false });
  }
});

export default router;
