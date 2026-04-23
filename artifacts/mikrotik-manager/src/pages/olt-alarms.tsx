import React from "react";
import { AlertOctagon, RefreshCw, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOltAlarms, useOltClearAlarm } from "@/hooks/use-olt";

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="text-muted-foreground">—</span>;
  const s = severity.toLowerCase();
  const cls =
    s.includes("critical") ? "bg-destructive/20 text-destructive border-destructive/40" :
    s.includes("major")    ? "bg-orange-500/15 text-orange-700 border-orange-500/30" :
    s.includes("minor")    ? "bg-amber-500/15 text-amber-700 border-amber-500/30" :
                              "bg-blue-500/15 text-blue-700 border-blue-500/30";
  return (
    <span className={"inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border " + cls}>
      {severity}
    </span>
  );
}

export default function OltAlarmsPage() {
  const q = useOltAlarms();
  const clear = useOltClearAlarm();
  const alarms = q.data?.alarms ?? [];

  const onClear = (id: string) => {
    if (!window.confirm(`Clear alarm ${id}? This runs \`clear alarm ${id}\` on the OLT.`)) return;
    clear.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <AlertOctagon className="h-8 w-8 text-primary" />
            Active Alarms
          </h1>
          <p className="text-muted-foreground mt-1">
            {alarms.length} active · display alarm active
          </p>
        </div>
        <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={"h-4 w-4 mr-2 " + (q.isFetching ? "animate-spin" : "")} />
          Refresh
        </Button>
      </div>

      {q.isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
          {q.error instanceof Error ? q.error.message : "Failed to load alarms"}
        </Card>
      )}

      {clear.isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
          Clear failed: {clear.error instanceof Error ? clear.error.message : "Unknown error"}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Severity</th>
                <th className="px-3 py-2 text-left">Occurred</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!q.isLoading && alarms.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-success">✓ No active alarms.</td></tr>
              )}
              {alarms.map((a, i) => (
                <tr key={`${a.id}-${i}`} className="border-t border-border/40 hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                  <td className="px-3 py-2"><SeverityBadge severity={a.severity} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{a.occurredAt ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{a.description || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onClear(a.id)}
                      disabled={clear.isPending}
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-40"
                      title={`clear alarm ${a.id}`}
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {q.data?.raw && (
        <Card className="p-5 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raw output</h2>
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed bg-black/40 text-slate-200 p-4 rounded-lg max-h-96 overflow-auto">
            {q.data.raw}
          </pre>
        </Card>
      )}
    </div>
  );
}
