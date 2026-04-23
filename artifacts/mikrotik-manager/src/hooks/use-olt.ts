import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterContext } from "@/lib/router-context";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

async function oltPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${apiBase}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j as T;
}

export interface OltDashboard {
  version: string;
  board: string;
  uptime: string | null;
  alarmCount: number | null;
  identity: string | null;
}

export interface OntRow {
  port: string;
  index: string;
  sn: string | null;
  runState: string | null;
  configState: string | null;
  matchState: string | null;
  description: string | null;
  lastDownCause: string | null;
}

export interface ServicePortRow {
  index: string;
  vlan: string | null;
  port: string | null;
  ontIndex: string | null;
  gemport: string | null;
  uservlan: string | null;
  state: string | null;
}

export interface AlarmRow {
  id: string;
  severity: string | null;
  occurredAt: string | null;
  description: string;
}

export function useOltDashboard() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "dashboard", credentials?.host],
    queryFn: () => oltPost<OltDashboard>("/olt/dashboard", credentials as any),
    enabled: !!credentials,
    refetchInterval: 30000,
  });
}

export function useOltOnts() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "onts", credentials?.host],
    queryFn: () => oltPost<{ onts: OntRow[] }>("/olt/onts", credentials as any),
    enabled: !!credentials,
  });
}

export function useOltOntOptical() {
  const { credentials } = useRouterContext();
  return useMutation({
    mutationFn: (vars: { port: string; ontIndex: number }) =>
      oltPost<{ output: string }>("/olt/ont/optical", { ...credentials, ...vars }),
  });
}

export function useOltServicePorts() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "service-ports", credentials?.host],
    queryFn: () =>
      oltPost<{ rows: ServicePortRow[]; raw: string }>("/olt/service-ports", credentials as any),
    enabled: !!credentials,
  });
}

export function useOltAddServicePort() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      vlan: number;
      port: string;
      ontIndex: number;
      gemport: number;
      uservlan: number;
      trafficTable?: number;
    }) => oltPost<{ output: string; success: boolean }>("/olt/service-port/add", { ...credentials, ...vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "service-ports"] }),
  });
}

export function useOltDeleteServicePort() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (index: number) =>
      oltPost<{ output: string; success: boolean }>("/olt/service-port/delete", { ...credentials, index }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "service-ports"] }),
  });
}

export function useOltAlarms() {
  const { credentials } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "alarms", credentials?.host],
    queryFn: () =>
      oltPost<{ alarms: AlarmRow[]; raw: string }>("/olt/alarms", credentials as any),
    enabled: !!credentials,
    refetchInterval: 30000,
  });
}

export function useOltCommand() {
  const { credentials } = useRouterContext();
  return useMutation({
    mutationFn: (command: string) =>
      oltPost<{ output: string; success: boolean }>("/olt/command", { ...credentials, command }),
  });
}
