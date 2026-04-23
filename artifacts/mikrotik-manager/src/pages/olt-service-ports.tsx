import React, { useState } from "react";
import { Plug, RefreshCw, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOltServicePorts, useOltAddServicePort, useOltDeleteServicePort } from "@/hooks/use-olt";
import { toast } from "sonner";

export default function OltServicePortsPage() {
  const q = useOltServicePorts();
  const addM = useOltAddServicePort();
  const delM = useOltDeleteServicePort();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    vlan: "100",
    port: "0/0/0",
    ontIndex: "0",
    gemport: "0",
    uservlan: "100",
    trafficTable: "6",
  });
  const [confirmIdx, setConfirmIdx] = useState<string | null>(null);

  const onAdd = async () => {
    try {
      const r = await addM.mutateAsync({
        vlan: Number(form.vlan),
        port: form.port,
        ontIndex: Number(form.ontIndex),
        gemport: Number(form.gemport),
        uservlan: Number(form.uservlan),
        trafficTable: Number(form.trafficTable),
      });
      if (r.success) {
        toast.success("Service-port added");
        setShowAdd(false);
      } else {
        toast.error(r.output || "Failed to add service-port");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add service-port");
    }
  };

  const onDelete = async (idx: string) => {
    try {
      const r = await delM.mutateAsync(Number(idx));
      if (r.success) toast.success(`Service-port ${idx} deleted`);
      else toast.error(r.output || "Failed to delete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setConfirmIdx(null);
    }
  };

  const rows = q.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Plug className="h-8 w-8 text-primary" />
            Service Ports
          </h1>
          <p className="text-muted-foreground mt-1">{rows.length} configured · display service-port all</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (q.isFetching ? "animate-spin" : "")} />
            Refresh
          </Button>
          <Button onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showAdd ? "Cancel" : "Add Service Port"}
          </Button>
        </div>
      </div>

      {q.isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
          {q.error instanceof Error ? q.error.message : "Failed to load service ports"}
        </Card>
      )}

      {showAdd && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            New service-port
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="VLAN" value={form.vlan} onChange={(v) => setForm({ ...form, vlan: v })} />
            <Field label="GPON port (F/S/P)" value={form.port} onChange={(v) => setForm({ ...form, port: v })} />
            <Field label="ONT index" value={form.ontIndex} onChange={(v) => setForm({ ...form, ontIndex: v })} />
            <Field label="GEM port" value={form.gemport} onChange={(v) => setForm({ ...form, gemport: v })} />
            <Field label="User VLAN" value={form.uservlan} onChange={(v) => setForm({ ...form, uservlan: v })} />
            <Field label="Traffic table idx" value={form.trafficTable} onChange={(v) => setForm({ ...form, trafficTable: v })} />
          </div>
          <div className="text-xs text-muted-foreground font-mono bg-black/40 text-slate-200 p-3 rounded-lg">
            service-port vlan {form.vlan} gpon {form.port} ont {form.ontIndex} gemport {form.gemport} multi-service user-vlan {form.uservlan} inbound traffic-table index {form.trafficTable} outbound traffic-table index {form.trafficTable}
          </div>
          <div className="flex justify-end">
            <Button onClick={onAdd} disabled={addM.isPending}>
              {addM.isPending ? "Adding…" : "Run command"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Index</th>
                <th className="px-3 py-2 text-left">VLAN</th>
                <th className="px-3 py-2 text-left">GPON port</th>
                <th className="px-3 py-2 text-left">ONT</th>
                <th className="px-3 py-2 text-left">GEM</th>
                <th className="px-3 py-2 text-left">User VLAN</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No service-ports configured.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.index} className="border-t border-border/40 hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono text-xs">{row.index}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.vlan ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.port ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.ontIndex ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.gemport ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.uservlan ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.state ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {confirmIdx === row.index ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onDelete(row.index)}
                          disabled={delM.isPending}
                          className="text-xs text-destructive hover:underline"
                        >
                          Confirm
                        </button>
                        <button onClick={() => setConfirmIdx(null)} className="text-xs text-muted-foreground hover:underline">
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmIdx(row.index)}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
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
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed bg-black/40 text-slate-200 p-4 rounded-lg max-h-72 overflow-auto">
            {q.data.raw}
          </pre>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
    </div>
  );
}
