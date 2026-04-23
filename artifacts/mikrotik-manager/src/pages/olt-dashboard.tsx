import React from "react";
import { Activity, Cpu, Clock, AlertOctagon, RefreshCw, Server } from "lucide-react";
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
