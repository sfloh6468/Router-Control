import { Router, type IRouter } from "express";
import { z } from "zod";
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
import { requireUser, requireWriter } from "../middlewares/requireAuth";
import {
  withRouter,
  type RouterAdapter,
  type RouterCreds,
} from "../lib/router-transport";

const router: IRouter = Router();

// Read-only endpoints: any signed-in (non-disabled) user.
// Mutating endpoints: read_write or superuser only.
router.use(requireUser);

/**
 * Open a transport-aware connection (binary API / REST / SSH), run `fn` against
 * the unified adapter, and always close the connection. The adapter exposes
 * the same `.menu(path).get/getOnly/add/update/remove/enable/disable` surface
 * as routeros-client did, so the rest of this file stays unchanged.
 */
async function withClient<T>(
  creds: RouterCreds,
  fn: (client: RouterAdapter) => Promise<T>,
): Promise<T> {
  return await withRouter(creds, fn);
}

// Adapters return records with camelCase keys and `id` (no leading dot),
// matching the routeros-client convention. Also parses numeric strings →
// numbers and "true"/"false" → booleans.
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

// Base credentials schema used for write operations
const WriteBase = z.object({
  host: z.string(),
  port: z.number().optional(),
  username: z.string(),
  password: z.string(),
  transport: z.enum(["api", "api-ssl", "rest", "rest-tls", "ssh"]).optional(),
});

// ─────────────────────────── READ ROUTES ───────────────────────────

router.post("/mikrotik/connect", async (req, res): Promise<void> => {
  const parsed = TestConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password, transport } = parsed.data;
  try {
    const result = await withClient({host, port, username, password, transport}, async (client) => {
      const sysRes = await client.menu("/system/resource").getOnly();
      let identityName: string | null = null;
      try {
        const ident = await client.menu("/system/identity").getOnly();
        identityName = str((ident as Record<string, unknown>)["name"]) || null;
      } catch {
        // identity unavailable — non-fatal
      }
      return { sys: sysRes, identityName };
    });
    const d = result.sys as Record<string, unknown>;
    res.json({
      success: true,
      message: "Connected successfully",
      identity: result.identityName,
      routerOs: str(d["version"]),
      routerBoard: str(d["boardName"]),
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
  const { host, port, username, password, transport } = parsed.data;
  try {
    const d = await withClient({host, port, username, password, transport}, async (client) => {
      return client.menu("/system/resource").getOnly() as Promise<Record<string, unknown>>;
    });
    res.json({
      uptime: str(d["uptime"]),
      version: str(d["version"]),
      buildTime: str(d["buildTime"]),
      boardName: str(d["boardName"]),
      platform: str(d["platform"]),
      cpuLoad: str(d["cpuLoad"]),
      freeMemory: str(d["freeMemory"]),
      totalMemory: str(d["totalMemory"]),
      freeHddSpace: str(d["freeHddSpace"]),
      totalHddSpace: str(d["totalHddSpace"]),
      cpuCount: str(d["cpuCount"]),
      cpuFrequency: str(d["cpuFrequency"]),
      architecture: str(d["architectureName"]),
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
  const { host, port, username, password, transport } = parsed.data;
  try {
    const items = await withClient({host, port, username, password, transport}, async (client) => {
      return client.menu("/interface").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d["id"]),
        name: str(d["name"]),
        type: str(d["type"]),
        mtu: str(d["mtu"]),
        macAddress: str(d["macAddress"]),
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
  const { host, port, username, password, transport } = parsed.data;
  try {
    const items = await withClient({host, port, username, password, transport}, async (client) => {
      return client.menu("/ip/address").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d["id"]),
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
  const { host, port, username, password, transport } = parsed.data;
  try {
    const items = await withClient({host, port, username, password, transport}, async (client) => {
      return client.menu("/ip/firewall/filter").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d["id"]),
        chain: str(d["chain"]),
        action: str(d["action"]),
        protocol: str(d["protocol"]),
        srcAddress: str(d["srcAddress"]),
        dstAddress: str(d["dstAddress"]),
        dstPort: str(d["dstPort"]),
        inInterface: str(d["inInterface"]),
        outInterface: str(d["outInterface"]),
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
  const { host, port, username, password, transport } = parsed.data;
  try {
    const items = await withClient({host, port, username, password, transport}, async (client) => {
      return client.menu("/ip/dhcp-server/lease").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d["id"]),
        address: str(d["address"]),
        macAddress: str(d["macAddress"]),
        hostname: str(d["hostName"]),
        status: str(d["status"]),
        expiresAfter: str(d["expiresAfter"]),
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
  const { host, port, username, password, transport } = parsed.data;
  try {
    const items = await withClient({host, port, username, password, transport}, async (client) => {
      return client.menu("/interface/wireless/registration-table").get() as Promise<Record<string, unknown>[]>;
    });
    res.json(
      items.map((d) => ({
        id: str(d["id"]),
        interface: str(d["interface"]),
        macAddress: str(d["macAddress"]),
        uptime: str(d["uptime"]),
        signalStrength: str(d["signalStrength"]),
        txRate: str(d["txRate"]),
        rxRate: str(d["rxRate"]),
        ssid: str(d["ssid"]),
      }))
    );
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// ─────────────────────────── TERMINAL ROUTE ───────────────────────────

/**
 * Full RouterOS command parser supporting:
 *   /menu/path print
 *   /menu/path add key=val key=val
 *   /menu/path set 0 key=val      (index-based)
 *   /menu/path set *1 key=val     (.id-based)
 *   /menu/path remove 0
 *   /menu/path enable 0
 *   /menu/path disable 0
 */
async function executeRosCommand(
  client: RouterAdapter,
  command: string
): Promise<string> {
  // SSH transport: pass the line straight through to the shell — RouterOS
  // already understands the full CLI grammar, no need to re-parse it.
  if (client.transport === "ssh") {
    const trimmed = command.trim();
    if (!trimmed || trimmed.startsWith("#")) return "";
    const out = await client.exec(trimmed);
    return out.replace(/\r/g, "").trimEnd() || "(no output)";
  }
  const trimmed = command.trim();
  if (!trimmed || trimmed.startsWith("#")) return "";

  const parts = trimmed.split(/\s+/);
  const SUB_CMDS = new Set(["add", "set", "remove", "delete", "print", "get", "enable", "disable", "move", "export"]);

  // Find where the sub-command begins
  let cmdIdx = parts.length;
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i].toLowerCase().replace(/^\//, "");
    if (SUB_CMDS.has(w)) {
      cmdIdx = i;
      break;
    }
  }

  // Build the menu path
  const pathParts = parts.slice(0, cmdIdx);
  let menuPath = pathParts.join("/").replace(/\/\//g, "/");
  if (!menuPath.startsWith("/")) menuPath = "/" + menuPath;

  const subCmd = cmdIdx < parts.length
    ? parts[cmdIdx].toLowerCase().replace(/^\//, "")
    : "print";

  const argParts = parts.slice(cmdIdx + 1);

  // Parse arguments
  const args: Record<string, string> = {};
  let idArg: string | number | undefined;
  const whereArgs: Record<string, string> = {};
  let inFind = false;

  for (const part of argParts) {
    if (part === "[find" || part === "[find]" || part === "find") { inFind = true; continue; }
    if (part === "]") { inFind = false; continue; }
    // Bare RouterOS .id like *1A
    if (/^\*[0-9a-fA-F]+$/.test(part)) { idArg = part; continue; }
    // Bare number = positional index
    if (/^\d+$/.test(part)) { idArg = parseInt(part, 10); continue; }
    const match = part.match(/^=?([^=]+)=(.*)$/);
    if (match) {
      const key = match[1]; const val = match[2];
      if (key === ".id" || key === "id") { idArg = val; }
      else if (inFind) { whereArgs[key] = val; }
      else { args[key] = val; }
    }
  }

  const menu = client.menu(menuPath);

  switch (subCmd) {
    case "print":
    case "get": {
      try {
        const filter = Object.keys(whereArgs).length > 0 ? whereArgs : undefined;
        const data = await menu.get(filter);
        if (!Array.isArray(data) || data.length === 0) return "(no entries)";
        // Pretty-print as numbered list
        return (data as Record<string, unknown>[])
          .map((item, i) => {
            const lines = Object.entries(item).map(([k, v]) => `  ${k}=${v}`);
            return `[${i}]\n${lines.join("\n")}`;
          })
          .join("\n\n");
      } catch {
        try {
          const data = await menu.getOnly();
          const lines = Object.entries(data as Record<string, unknown>).map(([k, v]) => `  ${k}=${v}`);
          return lines.join("\n");
        } catch (e2) {
          throw e2;
        }
      }
    }
    case "add": {
      const result = await menu.add(args);
      return `Added successfully.\n  .id=${(result as Record<string, unknown>)?.id ?? JSON.stringify(result)}`;
    }
    case "set": {
      if (idArg !== undefined) {
        await (menu as any).update(args, idArg);
        return `Updated ${idArg} successfully.`;
      } else {
        // No ID — update entire menu (e.g. /system identity set name=X)
        await (menu as any).update(args);
        return `Updated successfully.`;
      }
    }
    case "remove":
    case "delete": {
      if (idArg === undefined) throw new Error("remove requires an ID or index (e.g. remove 0 or remove *1A)");
      await (menu as any).remove(idArg);
      return `Removed ${idArg} successfully.`;
    }
    case "enable": {
      if (idArg === undefined) throw new Error("enable requires an ID or index");
      await (menu as any).enable(idArg);
      return `Enabled ${idArg} successfully.`;
    }
    case "disable": {
      if (idArg === undefined) throw new Error("disable requires an ID or index");
      await (menu as any).disable(idArg);
      return `Disabled ${idArg} successfully.`;
    }
    case "export": {
      const data = await menu.get();
      return JSON.stringify(data, null, 2);
    }
    default:
      return `"${subCmd}" is not supported. Supported: print, add, set, remove, enable, disable, export`;
  }
}

router.post("/mikrotik/command", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = RunCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { host, port, username, password, transport, command } = parsed.data;
  try {
    const result = await withClient({host, port, username, password, transport}, async (client) => {
      return executeRosCommand(client, command);
    });
    res.json({ output: result as string, success: true });
  } catch (err) {
    res.json({ output: `Error: ${errMsg(err)}`, success: false });
  }
});

// ─────────────────────────── EXPORT ROUTE ────────────────────────────

// Convert camelCase → dashed-case (routeros-client camelCases all field names)
function toDashed(key: string): string {
  return key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

// Internal keys to skip when building RSC lines
const SKIP_KEYS = new Set([".id", "snakeCase", "rosApi", "pathVal", "id"]);

// Fields that are read-only/runtime stats — never go in an RSC export
const READONLY_KEYS = new Set([
  "dynamic", "invalid", "running", "active", "status",
  "actualInterface", "lastLoggedIn", "bytes", "packets",
  "cacheUsed", "freqDrift", "status",
]);

function shouldSkipKey(k: string): boolean {
  if (SKIP_KEYS.has(k)) return true;
  if (READONLY_KEYS.has(k)) return true;
  if (k.startsWith("$") || k.startsWith("!")) return true;  // internal library fields
  return false;
}

// Format a single record as an "add" line
function recordToAdd(rec: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (shouldSkipKey(k) || v == null || v === "") continue;
    const key = toDashed(k);
    const val = String(v);
    // Quote values containing spaces
    parts.push(val.includes(" ") ? `${key}="${val}"` : `${key}=${val}`);
  }
  return `add ${parts.join(" ")}`;
}

// Safely fetch a menu section — returns [] if the section doesn't exist
async function safeGet(
  client: RouterAdapter,
  path: string
): Promise<Record<string, unknown>[]> {
  try {
    const items = await client.menu(path).get();
    return items;
  } catch {
    return [];
  }
}

// Safely fetch a single-record menu (like /ip/dns settings)
async function safeGetOne(
  client: RouterAdapter,
  path: string
): Promise<Record<string, unknown> | null> {
  try {
    const items = await client.menu(path).get();
    return items[0] ?? null;
  } catch {
    return null;
  }
}

// Build key=val pairs for a single record (for "set" commands)
function recordToSetPairs(rec: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (shouldSkipKey(k) || v == null || v === "") continue;
    const key = toDashed(k);
    const val = String(v);
    parts.push(val.includes(" ") ? `${key}="${val}"` : `${key}=${val}`);
  }
  return parts.join(" ");
}

// Build section block: "/path\nset k=v ...\n" or "/path\nadd ...\nadd ...\n"
function section(path: string, records: Record<string, unknown>[], isSet = false): string {
  if (records.length === 0) return "";
  const lines = [path];
  if (isSet) {
    const pairs = recordToSetPairs(records[0]);
    if (pairs) lines.push(`set ${pairs}`);
  } else {
    for (const rec of records) {
      lines.push(recordToAdd(rec));
    }
  }
  return lines.join("\n") + "\n";
}

router.post("/mikrotik/export", async (req, res): Promise<void> => {
  const parsed = WriteBase.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport } = parsed.data;
  try {
    const rsc = await withClient({host, port, username, password, transport}, async (client) => {
      const [
        identity,
        bridges,
        bridgePorts,
        vlans,
        ipAddresses,
        ipRoutes,
        arpEntries,
        dnsSettings,
        pools,
        dhcpServers,
        dhcpNetworks,
        dhcpClients,
        dhcpLeases,
        natRules,
        filterRules,
        mangleRules,
        rawRules,
        ntpClient,
        users,
      ] = await Promise.all([
        safeGetOne(client, "/system/identity"),
        safeGet(client, "/interface/bridge"),
        safeGet(client, "/interface/bridge/port"),
        safeGet(client, "/interface/vlan"),
        safeGet(client, "/ip/address"),
        safeGet(client, "/ip/route"),
        safeGet(client, "/ip/arp"),
        safeGetOne(client, "/ip/dns"),
        safeGet(client, "/ip/pool"),
        safeGet(client, "/ip/dhcp-server"),
        safeGet(client, "/ip/dhcp-server/network"),
        safeGet(client, "/ip/dhcp-client"),
        safeGet(client, "/ip/dhcp-server/lease"),
        safeGet(client, "/ip/firewall/nat"),
        safeGet(client, "/ip/firewall/filter"),
        safeGet(client, "/ip/firewall/mangle"),
        safeGet(client, "/ip/firewall/raw"),
        safeGetOne(client, "/system/ntp/client"),
        safeGet(client, "/user"),
      ]);

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      const identityName = identity ? String(identity["name"] ?? host) : host;

      const parts: string[] = [
        `# ${now} by MikroTik RouterOS`,
        `# model = ${identityName}`,
        "",
      ];

      // System identity
      if (identity) {
        parts.push("/system identity");
        parts.push(`set name=${String(identity["name"] ?? host)}`);
        parts.push("");
      }

      // NTP client
      if (ntpClient) {
        const ntpPairs = recordToSetPairs(ntpClient);
        if (ntpPairs) {
          parts.push("/system ntp client");
          parts.push(`set ${ntpPairs}`);
          parts.push("");
        }
      }

      // Bridge interfaces
      if (bridges.length > 0) {
        parts.push(section("/interface bridge", bridges));
        parts.push("");
      }

      // Bridge ports
      if (bridgePorts.length > 0) {
        parts.push(section("/interface bridge port", bridgePorts));
        parts.push("");
      }

      // VLANs
      if (vlans.length > 0) {
        parts.push(section("/interface vlan", vlans));
        parts.push("");
      }

      // IP pools
      if (pools.length > 0) {
        parts.push(section("/ip pool", pools));
        parts.push("");
      }

      // DHCP server
      if (dhcpServers.length > 0) {
        parts.push(section("/ip dhcp-server", dhcpServers));
        parts.push("");
      }

      // DHCP server networks
      if (dhcpNetworks.length > 0) {
        parts.push(section("/ip dhcp-server network", dhcpNetworks));
        parts.push("");
      }

      // DHCP client
      if (dhcpClients.length > 0) {
        parts.push(section("/ip dhcp-client", dhcpClients));
        parts.push("");
      }

      // Static DHCP leases only
      const staticLeases = dhcpLeases.filter((l) => l["addressType"] === "static" || l["dynamic"] === "false" || l["dynamic"] === false);
      if (staticLeases.length > 0) {
        parts.push(section("/ip dhcp-server lease", staticLeases));
        parts.push("");
      }

      // IP addresses (static only)
      const staticAddresses = ipAddresses.filter(
        (a) => a["dynamic"] !== "true" && a["dynamic"] !== true
      );
      if (staticAddresses.length > 0) {
        parts.push(section("/ip address", staticAddresses));
        parts.push("");
      }

      // IP routes (static only — skip dynamic/connected)
      const staticRoutes = ipRoutes.filter(
        (r) => r["dynamic"] !== "true" && r["dynamic"] !== true
      );
      if (staticRoutes.length > 0) {
        parts.push(section("/ip route", staticRoutes));
        parts.push("");
      }

      // ARP (static only)
      const staticArp = arpEntries.filter((a) => a["dynamic"] !== "true" && a["dynamic"] !== true);
      if (staticArp.length > 0) {
        parts.push(section("/ip arp", staticArp));
        parts.push("");
      }

      // DNS
      if (dnsSettings) {
        const dnsPairs = recordToSetPairs(dnsSettings);
        if (dnsPairs) {
          parts.push("/ip dns");
          parts.push(`set ${dnsPairs}`);
          parts.push("");
        }
      }

      // Firewall NAT
      if (natRules.length > 0) {
        parts.push(section("/ip firewall nat", natRules));
        parts.push("");
      }

      // Firewall filter
      if (filterRules.length > 0) {
        parts.push(section("/ip firewall filter", filterRules));
        parts.push("");
      }

      // Firewall mangle
      if (mangleRules.length > 0) {
        parts.push(section("/ip firewall mangle", mangleRules));
        parts.push("");
      }

      // Firewall raw
      if (rawRules.length > 0) {
        parts.push(section("/ip firewall raw", rawRules));
        parts.push("");
      }

      // Users (skip admin to avoid overwriting)
      const nonAdminUsers = users.filter((u) => u["name"] !== "admin");
      if (nonAdminUsers.length > 0) {
        parts.push(section("/user", nonAdminUsers));
        parts.push("");
      }

      return parts.join("\n");
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mikrotik-${host}-${timestamp}.rsc"`);
    res.send(rsc);
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

// ─────────────────────────── WRITE ROUTES ───────────────────────────

// ---- Interfaces ----
router.post("/mikrotik/interface/toggle", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string(), disabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id, disabled } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      const menu = client.menu("/interface") as any;
      if (disabled) { await menu.disable(id); } else { await menu.enable(id); }
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

router.post("/mikrotik/interface/comment", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string(), comment: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id, comment } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      await (client.menu("/interface") as any).update({ comment }, id);
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

// ---- IP Addresses ----
router.post("/mikrotik/ip/address/add", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({
    address: z.string(),
    interface: z.string(),
    comment: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, address, interface: iface, comment } = parsed.data;
  try {
    const result = await withClient({host, port, username, password, transport}, async (client) => {
      return client.menu("/ip/address").add({
        address,
        interface: iface,
        ...(comment ? { comment } : {}),
      });
    });
    res.json({ success: true, id: (result as Record<string, unknown>)?.id });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

router.post("/mikrotik/ip/address/remove", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      await (client.menu("/ip/address") as any).remove(id);
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

router.post("/mikrotik/ip/address/toggle", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string(), disabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id, disabled } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      const menu = client.menu("/ip/address") as any;
      if (disabled) { await menu.disable(id); } else { await menu.enable(id); }
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

// ---- Firewall Filter Rules ----
router.post("/mikrotik/firewall/filter/add", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({
    chain: z.string(),
    action: z.string(),
    protocol: z.string().optional(),
    srcAddress: z.string().optional(),
    dstAddress: z.string().optional(),
    dstPort: z.string().optional(),
    inInterface: z.string().optional(),
    comment: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, chain, action, protocol, srcAddress, dstAddress, dstPort, inInterface, comment } = parsed.data;
  try {
    const result = await withClient({host, port, username, password, transport}, async (client) => {
      const entry: Record<string, string> = { chain, action };
      if (protocol) entry["protocol"] = protocol;
      if (srcAddress) entry["src-address"] = srcAddress;
      if (dstAddress) entry["dst-address"] = dstAddress;
      if (dstPort) entry["dst-port"] = dstPort;
      if (inInterface) entry["in-interface"] = inInterface;
      if (comment) entry["comment"] = comment;
      return client.menu("/ip/firewall/filter").add(entry);
    });
    res.json({ success: true, id: (result as Record<string, unknown>)?.id });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

router.post("/mikrotik/firewall/filter/remove", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      await (client.menu("/ip/firewall/filter") as any).remove(id);
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

router.post("/mikrotik/firewall/filter/toggle", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string(), disabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id, disabled } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      const menu = client.menu("/ip/firewall/filter") as any;
      if (disabled) { await menu.disable(id); } else { await menu.enable(id); }
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

// ---- DHCP Leases ----
router.post("/mikrotik/dhcp/lease/remove", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      await (client.menu("/ip/dhcp-server/lease") as any).remove(id);
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

router.post("/mikrotik/dhcp/lease/make-static", ...requireWriter(), async (req, res): Promise<void> => {
  const parsed = WriteBase.extend({ id: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { host, port, username, password, transport, id } = parsed.data;
  try {
    await withClient({host, port, username, password, transport}, async (client) => {
      // RouterOS make-static command
      await (client.menu("/ip/dhcp-server/lease") as any).update({ "make-static": "yes" }, id);
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: errMsg(err) }); }
});

export default router;
