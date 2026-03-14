import { useQuery, useMutation } from "@tanstack/react-query";
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

// Wrappers around the generated API functions to automatically inject credentials
// and use useQuery instead of useMutation for standard data fetching.

export function useMikrotikSystem() {
  const { credentials } = useRouterContext();
  
  return useQuery({
    queryKey: ["mikrotik", "system", credentials?.host],
    queryFn: () => getSystemResource(credentials!),
    enabled: !!credentials,
    refetchInterval: 10000, // auto refresh every 10s
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
      const req: CommandRequest = {
        ...credentials,
        command
      };
      return runCommand(req);
    }
  });
}

export function useMikrotikConnect() {
  return useMutation({
    mutationFn: (credentials: RouterCredentials) => testConnection(credentials)
  });
}
