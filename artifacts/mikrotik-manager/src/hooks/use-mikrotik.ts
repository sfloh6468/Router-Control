import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getSystemResource, 
  getInterfaces, 
  getIpAddresses, 
  getFirewallRules, 
  getDhcpLeases, 
  getWirelessClients,
  runCommand,
  testConnection
} from "@workspace/api-client-react";
import type { CommandRequest, RouterCredentials } from "@workspace/api-client-react";
import { useRouterContext } from "@/lib/router-context";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function apiPost<T = { success: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ─── Read Hooks ────────────────────────────────────────────────────────────

export function useMikrotikSystem() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["mikrotik", "system", credentials?.host],
    queryFn: () => getSystemResource(credentials!),
    enabled: !!credentials,
    refetchInterval: 10000,
  });
}

export function useMikrotikInterfaces() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["mikrotik", "interfaces", credentials?.host],
    queryFn: () => getInterfaces(credentials!),
    enabled: !!credentials,
    refetchInterval: 30000,
  });
}

export function useMikrotikIpAddresses() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["mikrotik", "ip-addresses", credentials?.host],
    queryFn: () => getIpAddresses(credentials!),
    enabled: !!credentials,
  });
}

export function useMikrotikFirewallRules() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["mikrotik", "firewall-rules", credentials?.host],
    queryFn: () => getFirewallRules(credentials!),
    enabled: !!credentials,
  });
}

export function useMikrotikDhcpLeases() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["mikrotik", "dhcp-leases", credentials?.host],
    queryFn: () => getDhcpLeases(credentials!),
    enabled: !!credentials,
    refetchInterval: 30000,
  });
}

export function useMikrotikWirelessClients() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["mikrotik", "wireless-clients", credentials?.host],
    queryFn: () => getWirelessClients(credentials!),
    enabled: !!credentials,
    refetchInterval: 15000,
  });
}

export function useMikrotikCommand() {
  const { credentials } = useRouterContext();
  return useMutation({
    mutationFn: (command: string) => {
      if (!credentials) throw new Error("Not connected");
      const req: CommandRequest = { ...credentials, command };
      return runCommand(req);
    }
  });
}

export function useMikrotikConnect() {
  return useMutation({
    mutationFn: (credentials: RouterCredentials) => testConnection(credentials)
  });
}

// ─── Write Hooks — Interfaces ──────────────────────────────────────────────

export function useToggleInterface() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      apiPost("/mikrotik/interface/toggle", { ...credentials!, id, disabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "interfaces"] }),
  });
}

export function useSetInterfaceComment() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      apiPost("/mikrotik/interface/comment", { ...credentials!, id, comment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "interfaces"] }),
  });
}

// ─── Write Hooks — IP Addresses ────────────────────────────────────────────

export function useAddIpAddress() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { address: string; interface: string; comment?: string }) =>
      apiPost("/mikrotik/ip/address/add", { ...credentials!, ...data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "ip-addresses"] }),
  });
}

export function useRemoveIpAddress() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost("/mikrotik/ip/address/remove", { ...credentials!, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "ip-addresses"] }),
  });
}

export function useToggleIpAddress() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      apiPost("/mikrotik/ip/address/toggle", { ...credentials!, id, disabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "ip-addresses"] }),
  });
}

// ─── Write Hooks — Firewall ────────────────────────────────────────────────

export function useAddFirewallRule() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      chain: string; action: string; protocol?: string;
      srcAddress?: string; dstAddress?: string; dstPort?: string;
      inInterface?: string; comment?: string;
    }) => apiPost("/mikrotik/firewall/filter/add", { ...credentials!, ...data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "firewall-rules"] }),
  });
}

export function useRemoveFirewallRule() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost("/mikrotik/firewall/filter/remove", { ...credentials!, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "firewall-rules"] }),
  });
}

export function useToggleFirewallRule() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      apiPost("/mikrotik/firewall/filter/toggle", { ...credentials!, id, disabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "firewall-rules"] }),
  });
}

// ─── Write Hooks — DHCP Leases ─────────────────────────────────────────────

export function useRemoveDhcpLease() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost("/mikrotik/dhcp/lease/remove", { ...credentials!, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "dhcp-leases"] }),
  });
}

export function useMakeDhcpLeaseStatic() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost("/mikrotik/dhcp/lease/make-static", { ...credentials!, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mikrotik", "dhcp-leases"] }),
  });
}
