import React, { useState } from "react";
import {
  Cable,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useOltOnts,
  useOltOntOptical,
  useOltOntAction,
  type OntRow,
} from "@/hooks/use-olt";

function StateBadge({ state }: { state: string | null }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  const s = state.toLowerCase();
  const cls =
    s === "online" || s === "active" || s === "match"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
      : s === "offline" || s === "los" || s === "dying-gasp"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return (
    <span className={"inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border " + cls}>
      {state}
    </span>
  );
}

function OntTableRow({ row }: { row: OntRow }) {
  const optical = useOltOntOptical();
  const action = useOltOntAction();
  const [open, setOpen] = useState(false);
  const fetchOptical = () => {
    setOpen(true);
    optical.mutate({ port: row.port, ontIndex: Number(row.index) });
  };

  const runAction = (a: "activate" | "deactivate" | "delete") => {
    if (a === "delete") {
      const ok = window.confirm(
        `Delete ONT ${row.index} on port ${row.port}? This cannot be undone from the UI.`,
      );
      if (!ok) return;
    }
    action.mutate({ port: row.port, ontIndex: Number(row.index), action: a });
  };

  const actionPending = action.isPending;
  return (
    <>
      <tr className="border-t border-border/40 hover:bg-accent/30">
        <td className="px-3 py-2 font-mono text-xs">{row.port}</td>
        <td className="px-3 py-2 font-mono text-xs">{row.index}</td>
        <td className="px-3 py-2 font-mono text-xs break-all">{row.sn ?? "—"}</td>
        <td className="px-3 py-2"><StateBadge state={row.runState} /></td>
        <td className="px-3 py-2"><StateBadge state={row.configState} /></td>
        <td className="px-3 py-2"><StateBadge state={row.matchState} /></td>
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {row.lastDownCause ?? "—"}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => runAction("activate")}
              disabled={actionPending}
              title="ont activate"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline disabled:opacity-40"
            >
              <Power className="h-3 w-3" /> Activate
            </button>
            <button
              onClick={() => runAction("deactivate")}
              disabled={actionPending}
              title="ont deactivate"
              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline disabled:opacity-40"
            >
              <PowerOff className="h-3 w-3" /> Deactivate
            </button>
            <button
              onClick={() => runAction("delete")}
              disabled={actionPending}
              title="ont delete"
              className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <button
              onClick={() => (open ? setOpen(false) : fetchOptical())}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Eye className="h-3 w-3" /> Optical
            </button>
          </div>
        </td>
      </tr>
      {action.isError && (
        <tr className="bg-destructive/10">
          <td colSpan={8} className="px-3 py-2 text-xs text-destructive">
            {action.error instanceof Error ? action.error.message : "Action failed"}
          </td>
        </tr>
      )}
      {action.data && !action.data.success && (
        <tr className="bg-destructive/10">
          <td colSpan={8} className="px-3 py-2 text-xs text-destructive font-mono whitespace-pre-wrap">
            {action.data.output || "Command rejected by OLT"}
          </td>
        </tr>
      )}
      {open && (
        <tr className="bg-black/40">
          <td colSpan={8} className="px-3 py-3">
            <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-200 max-h-64 overflow-auto">
              {optical.isPending
                ? "Loading optical info…"
                : optical.error
                  ? `Error: ${optical.error instanceof Error ? optical.error.message : String(optical.error)}`
                  : optical.data?.output ?? "(no output)"}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export default function OltOntsPage() {
  const q = useOltOnts();
  const onts = q.data?.onts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Cable className="h-8 w-8 text-primary" />
            ONUs
          </h1>
          <p className="text-muted-foreground mt-1">
            Discovered ONTs across all GPON ports · {onts.length} total
          </p>
        </div>
        <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={"h-4 w-4 mr-2 " + (q.isFetching ? "animate-spin" : "")} />
          Refresh
        </Button>
      </div>

      {q.isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
          {q.error instanceof Error ? q.error.message : "Failed to load ONTs"}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Port</th>
                <th className="px-3 py-2 text-left">Index</th>
                <th className="px-3 py-2 text-left">Serial Number</th>
                <th className="px-3 py-2 text-left">Run State</th>
                <th className="px-3 py-2 text-left">Config</th>
                <th className="px-3 py-2 text-left">Match</th>
                <th className="px-3 py-2 text-left">Last Down Cause</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Scanning all GPON ports…</td></tr>
              )}
              {!q.isLoading && onts.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No ONTs discovered.</td></tr>
              )}
              {onts.map((row, i) => (
                <OntTableRow key={`${row.port}-${row.index}-${i}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: For adding new ONTs and other provisioning beyond activate/deactivate/delete, use the chat assistant or terminal.
      </p>
    </div>
  );
}
