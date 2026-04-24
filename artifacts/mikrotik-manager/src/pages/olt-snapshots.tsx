import React, { useEffect, useState } from "react";
import { Archive, RefreshCw, Download, Upload, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouterContext } from "@/lib/router-context";
import { toast } from "sonner";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SnapshotMeta {
  id: string;
  identity: string | null;
  host: string;
  filename: string;
  size: number;
  createdAt: string;
}

interface ListResponse {
  configured: boolean;
  snapshots: SnapshotMeta[];
}

function fmtSize(n: number): string {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function OltSnapshotsPage() {
  const { credentials } = useRouterContext();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/olt/snapshots`);
      const j = (await r.json()) as ListResponse & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onDownload = async (snap: SnapshotMeta) => {
    setBusyId(snap.id);
    try {
      const r = await fetch(`${apiBase}/api/olt/snapshots/download?id=${snap.id}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = snap.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusyId(null);
    }
  };

  const onRestore = async (snap: SnapshotMeta) => {
    if (!credentials) { toast.error("Not connected to an OLT"); return; }
    const confirmText = `Apply snapshot "${snap.filename}" to the OLT?\n\nThis replays every command in the snapshot inside config mode and then runs \`save\`. Existing config that conflicts may produce errors per line.`;
    if (!window.confirm(confirmText)) return;
    setBusyId(snap.id);
    const tid = toast.loading("Applying snapshot…");
    try {
      const r = await fetch(`${apiBase}/api/olt/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, snapshotId: snap.id }),
      });
      const j = (await r.json()) as {
        success?: boolean; error?: string;
        appliedLines?: number; failureCount?: number;
      };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (j.success) {
        toast.success(`Applied ${j.appliedLines} commands`, { id: tid });
      } else {
        toast.warning(`Applied with ${j.failureCount} failed line(s) of ${j.appliedLines}`, { id: tid });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed", { id: tid });
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (snap: SnapshotMeta) => {
    if (!window.confirm(`Delete snapshot "${snap.filename}"?`)) return;
    setBusyId(snap.id);
    try {
      const r = await fetch(`${apiBase}/api/olt/snapshots?id=${snap.id}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const snaps = data?.snapshots ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Archive className="h-8 w-8 text-primary" />
            Config Snapshots
          </h1>
          <p className="text-muted-foreground mt-1">
            {snaps.length} archived · saved by clicking <em>Backup OLT Config</em>
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
          Refresh
        </Button>
      </div>

      {data && !data.configured && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/10 text-amber-800 text-sm">
          Object storage is not configured on this server, so snapshots can't be archived. The
          <em> Backup OLT Config</em> button still downloads the .cfg directly to your browser.
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Identity</th>
                <th className="px-3 py-2 text-left">Host</th>
                <th className="px-3 py-2 text-left">Captured</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && snaps.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No snapshots archived yet.</td></tr>
              )}
              {snaps.map((s) => (
                <tr key={s.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">{s.identity ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.host}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{fmtSize(s.size)}</td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <Button size="sm" variant="ghost" disabled={busyId === s.id} onClick={() => onDownload(s)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === s.id || !credentials}
                      onClick={() => onRestore(s)}
                      title={credentials ? "Apply this snapshot to the OLT" : "Connect to an OLT first"}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> Apply
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === s.id} onClick={() => onDelete(s)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
