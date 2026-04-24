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

async function oltGet<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${apiBase}/api${path}${qs.toString() ? `?${qs}` : ""}`;
  const r = await fetch(url, { method: "GET" });
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

async function oltDelete<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${apiBase}/api${path}${qs.toString() ? `?${qs}` : ""}`;
  const r = await fetch(url, { method: "DELETE" });
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
  inboundTt: string | null;
  outboundTt: string | null;
  state: string | null;
}

export interface OpticalInfo {
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  voltageV: number | null;
  temperatureC: number | null;
  biasMa: number | null;
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
      oltPost<{ output: string } & OpticalInfo>("/olt/ont/optical", {
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

// ─────────────────────────── OLT-side users & password policy ───────────────────────────

export interface OltTerminalUser {
  name: string;
  level: string | null;
  status: string | null;
  reenterNum: string | null;
  profile: string | null;
  appendInfo: string | null;
}

export interface PasswordPolicy {
  minLength: number | null;
  agingDays: number | null;
  modifyMode: string | null;
  complexity: string | null;
}

export type OltUserLevel = "common-user" | "operator" | "administrator";

export function useOltUsers() {
  const { credentials, vendor } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "users", credentials?.host],
    queryFn: () =>
      oltPost<{ users: OltTerminalUser[]; raw: string }>("/olt/users", credPayload(credentials)),
    enabled: !!credentials && vendor === "huawei-olt",
  });
}

export function useOltAddUser() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      newPassword: string;
      level: OltUserLevel;
      profile?: string;
      appendInfo?: string;
      reenterNum?: number;
    }) =>
      // Spread vars *after* credPayload so credential fields cannot be
      // overwritten by user-form fields. The OLT-side new account password
      // is intentionally named `newPassword` to avoid collision with the
      // SSH credential `password`.
      oltPost<{ output: string; success: boolean; error?: string; stepsCompleted?: number }>(
        "/olt/user/add",
        { ...credPayload(credentials), ...vars },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "users"] }),
  });
}

export function useOltDeleteUser() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      oltPost<{ output: string; success: boolean; error?: string }>(
        "/olt/user/delete",
        { ...credPayload(credentials), name },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "users"] }),
  });
}

export function useOltChangeUserPassword() {
  const { credentials } = useRouterContext();
  return useMutation({
    mutationFn: (vars: { name: string; newPassword: string }) =>
      oltPost<{ output: string; success: boolean; error?: string }>(
        "/olt/user/password",
        { ...credPayload(credentials), ...vars },
      ),
  });
}

export function useOltPasswordPolicy() {
  const { credentials, vendor } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "password-policy", credentials?.host],
    queryFn: () =>
      oltPost<{ policy: PasswordPolicy; raw: string }>(
        "/olt/password-policy",
        credPayload(credentials),
      ),
    enabled: !!credentials && vendor === "huawei-olt",
  });
}

export function useOltSetPasswordPolicy() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      minLength?: number;
      agingDays?: number;
      modifyMode?: "forced" | "recommended" | "none";
    }) =>
      oltPost<{ output: string; success: boolean }>("/olt/password-policy/set", {
        ...credPayload(credentials),
        ...vars,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "password-policy"] }),
  });
}

// ─────────────────────────── User login history ───────────────────────────

export interface OltUserSession {
  id: string;
  username: string;
  sourceIp: string | null;
  loginAt: string | null;
  logoutAt: string | null;
  channel: string | null;
  result: string | null;
  active: boolean;
  kickHandle: string | null;
}

export function useOltUserLogins() {
  const { credentials, vendor } = useRouterContext();
  return useQuery({
    queryKey: ["olt", "user-logins", credentials?.host],
    queryFn: () =>
      oltPost<{
        sessions: OltUserSession[];
        rawOnline: string;
        rawLog: string;
        /** Number of newly persisted audit rows on this poll (best-effort). */
        ingested?: number;
      }>("/olt/user-logins", credPayload(credentials)),
    enabled: !!credentials && vendor === "huawei-olt",
    refetchInterval: 30000,
  });
}

// ─────────────────────────── Historical login audit (DB) ───────────────────────────

export interface OltLoginHistoryEvent {
  id: number;
  host: string;
  username: string;
  sourceIp: string | null;
  channel: string | null;
  /** ISO 8601 string (or null if unparseable on ingest) */
  loginAt: string | null;
  /** Original device-formatted string */
  loginAtRaw: string;
  logoutAt: string | null;
  logoutAtRaw: string | null;
  result: string;
  seenAt: string;
  lastSeenAt: string;
}

export interface OltLoginHistoryFilters {
  host?: string;
  from?: string;
  to?: string;
  username?: string;
  sourceIp?: string;
  channel?: string;
  result?: "success" | "fail";
  limit?: number;
  offset?: number;
}

export function useOltLoginHistory(filters: OltLoginHistoryFilters, opts?: { enabled?: boolean }) {
  const { credentials } = useRouterContext();
  const host = filters.host ?? credentials?.host;
  return useQuery({
    queryKey: ["olt", "login-history", host, filters],
    queryFn: () =>
      oltGet<{ events: OltLoginHistoryEvent[]; total: number; limit: number; offset: number }>(
        "/olt/login-history",
        { ...filters, host },
      ),
    enabled: opts?.enabled !== false && !!host,
  });
}

export function useOltPurgeLoginHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id?: number;
      host?: string;
      before?: string;
      all?: boolean;
    }) =>
      oltDelete<{ success: boolean; deleted: number }>("/olt/login-history", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "login-history"] }),
  });
}

export function useOltKickUser() {
  const { credentials } = useRouterContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { target: string; byIndex?: boolean }) =>
      oltPost<{ output: string; success: boolean; error?: string }>(
        "/olt/user-logout",
        { ...credPayload(credentials), ...vars },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["olt", "user-logins"] }),
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
