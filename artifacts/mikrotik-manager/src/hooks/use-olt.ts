import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterContext } from "@/lib/router-context";
import type { RouterCredentials } from "@workspace/api-client-react";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Build a JSON-safe credential payload. RouterCredentials is a generated
 * union — for the OLT path we only ever need host/port/username/password,
 * so we narrow explicitly here instead of leaning on `as any`.
 */
function credPayload(c: RouterCredentials | null): Record<string, unknown> {
  if (!c) return {};
  return {
    host: c.host,
    port: c.port,
    username: c.username,
    password: c.password,
  };
}

async function oltPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${apiBase}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

export interface GponPortSummary {
  port: string;
  state: string | null;
}

export interface OltDashboard {
  version: string;
  board: string;
  uptime: string | null;
  alarmCount: number | null;
  identity: string | null;
  gponPorts: GponPortSummary[];
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
  const { credentials, vendor } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "dashboard", credentials?.host],
    queryFn: () => oltPost<OltDashboard>("/olt/dashboard", credPayload(credentials)),
    enabled: !!credentials && vendor === "huawei-olt",
    refetchInterval: 30000,
  });
}

export function useOltOnts() {
  const { credentials, vendor } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "onts", credentials?.host],
    queryFn: () => oltPost<{ onts: OntRow[] }>("/olt/onts", credPayload(credentials)),
    enabled: !!credentials && vendor === "huawei-olt",
  });
}

export function useOltOntOptical() {
  const { credentials } = useRouterContext();
  return useMutation({
    mutationFn: (vars: { port: string; ontIndex: number }) =>
      oltPost<{ output: string }>("/olt/ont/optical", {
        ...credPayload(credentials),
        ontPort: vars.port,
        ontIndex: vars.ontIndex,
      }),
  });
}

export function useOltOntAction() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      port: string;
      ontIndex: number;
      action: "activate" | "deactivate" | "delete";
    }) =>
      oltPost<{ output: string; success: boolean }>("/olt/ont/action", {
        ...credPayload(credentials),
        ontPort: vars.port,
        ontIndex: vars.ontIndex,
        action: vars.action,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "onts"] }),
  });
}

export function useOltServicePorts() {
  const { credentials, vendor } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "service-ports", credentials?.host],
    queryFn: () =>
      oltPost<{ rows: ServicePortRow[]; raw: string }>("/olt/service-ports", credPayload(credentials)),
    enabled: !!credentials && vendor === "huawei-olt",
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
    }) =>
      oltPost<{ output: string; success: boolean }>("/olt/service-port/add", {
        ...credPayload(credentials),
        vlan: vars.vlan,
        gponPort: vars.port,
        ontIndex: vars.ontIndex,
        gemport: vars.gemport,
        uservlan: vars.uservlan,
        trafficTable: vars.trafficTable,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "service-ports"] }),
  });
}

export function useOltDeleteServicePort() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (index: number) =>
      oltPost<{ output: string; success: boolean }>("/olt/service-port/delete", {
        ...credPayload(credentials),
        index,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "service-ports"] }),
  });
}

export function useOltAlarms() {
  const { credentials, vendor } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "alarms", credentials?.host],
    queryFn: () =>
      oltPost<{ alarms: AlarmRow[]; raw: string }>("/olt/alarms", credPayload(credentials)),
    enabled: !!credentials && vendor === "huawei-olt",
    refetchInterval: 30000,
  });
}

export function useOltClearAlarm() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alarmId: string) =>
      oltPost<{ output: string; success: boolean }>("/olt/alarm/clear", {
        ...credPayload(credentials),
        alarmId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "alarms"] }),
  });
}

export function useOltCommand() {
  const { credentials } = useRouterContext();
  return useMutation({
    mutationFn: (command: string) =>
      oltPost<{ output: string; success: boolean }>("/olt/command", {
        ...credPayload(credentials),
        command,
      }),
  });
}
