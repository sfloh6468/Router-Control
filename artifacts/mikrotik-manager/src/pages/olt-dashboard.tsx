import React from "react";
import { Activity, Cpu, Clock, AlertOctagon, RefreshCw, Server, Cable } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOltDashboard } from "@/hooks/use-olt";
import { useRouterContext } from "@/lib/router-context";

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="text-lg font-semibold text-foreground break-words">{value ?? "—"}</div>
    </Card>
  );
}

export default function OltDashboardPage() {
  const { meta } = useRouterContext();
  const q = useOltDashboard();
  const data = q.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            OLT Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Huawei SmartAX overview · {meta.identity ?? "(unknown sysname)"}
          </p>
        </div>
        <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={"h-4 w-4 mr-2 " + (q.isFetching ? "animate-spin" : "")} />
          Refresh
        </Button>
      </div>

      {q.isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
          {q.error instanceof Error ? q.error.message : "Failed to load dashboard"}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Server} label="Identity" value={data?.identity ?? meta.identity} />
        <Stat icon={Cpu} label="Software" value={meta.routerOs ?? "—"} />
        <Stat icon={Clock} label="Uptime" value={data?.uptime ?? "—"} />
        <Stat
          icon={AlertOctagon}
          label="Active Alarms"
          value={
            data?.alarmCount == null ? "—" : (
              <span className={data.alarmCount > 0 ? "text-destructive" : "text-success"}>
                {data.alarmCount}
              </span>
            )
          }
        />
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Cable className="h-4 w-4 text-primary" />
            GPON Ports  ·  display port state 0
          </h2>
          <span className="text-xs text-muted-foreground">
            {data?.gponPorts?.length ?? 0} discovered
          </span>
        </div>
        {(!data?.gponPorts || data.gponPorts.length === 0) ? (
          <p className="text-sm text-muted-foreground">
            {q.isLoading ? "Probing ports…" : "No GPON ports reported."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {data.gponPorts.map((p) => {
              const s = (p.state ?? "").toLowerCase();
              const tone =
                s === "online" || s === "active" || s === "up"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                  : s === "offline" || s === "down" || s === "abnormal" || s === "inactive"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-accent/30 text-muted-foreground";
              return (
                <div
                  key={p.port}
                  className={"rounded-md border px-3 py-2 flex flex-col gap-0.5 " + tone}
                >
                  <span className="font-mono text-xs">{p.port}</span>
                  <span className="text-[10px] uppercase tracking-wider">
                    {p.state ?? "unknown"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Board Inventory  ·  display board 0
        </h2>
        <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed bg-black/40 text-slate-200 p-4 rounded-lg max-h-72 overflow-auto">
          {data?.board ?? (q.isLoading ? "Loading…" : "—")}
        </pre>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Software / Hardware  ·  display version
        </h2>
        <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed bg-black/40 text-slate-200 p-4 rounded-lg max-h-72 overflow-auto">
          {data?.version ?? (q.isLoading ? "Loading…" : "—")}
        </pre>
      </Card>
    </div>
  );
}
