import { useState } from "react";
import { Shield, ShieldAlert, ShieldCheck, Eye, Pencil, UserX, UserCheck, Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe, useUsersList, updateUser, type ManagedUser } from "@/hooks/use-admin";

const ROLE_OPTIONS: Array<{ value: ManagedUser["role"]; label: string; icon: React.ComponentType<any>; help: string }> = [
  { value: "read_only", label: "Read-only", icon: Eye, help: "Can connect & read state. Cannot change router config." },
  { value: "read_write", label: "Read / write", icon: Pencil, help: "Can connect, read, and run mutating commands." },
  { value: "superuser", label: "Superuser", icon: ShieldAlert, help: "Full admin including managing user accounts." },
];

function RoleBadge({ role }: { role: ManagedUser["role"] }) {
  const opt = ROLE_OPTIONS.find((o) => o.value === role)!;
  const Icon = opt.icon;
  const cls = role === "superuser"
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : role === "read_write"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      <Icon className="h-3 w-3" />
      {opt.label}
    </span>
  );
}

export default function AdminPage() {
  const me = useMe();
  const list = useUsersList(me.data?.isSuper === true);
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const onChangeRole = async (u: ManagedUser, role: ManagedUser["role"]) => {
    if (role === u.role) return;
    setSavingId(u.clerkUserId);
    try {
      await updateUser(u.clerkUserId, { role });
      toast.success(`Updated ${u.email ?? u.clerkUserId} → ${role}`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const onToggleDisabled = async (u: ManagedUser) => {
    setSavingId(u.clerkUserId);
    try {
      await updateUser(u.clerkUserId, { disabled: !u.disabled });
      toast.success(u.disabled ? "User enabled" : "User disabled");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  if (me.isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  if (!me.data?.isSuper) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <h2 className="font-semibold">Superuser only</h2>
          <p className="text-sm mt-1">
            Your role is <strong>{me.data?.role ?? "unknown"}</strong>. Only superusers can manage user accounts.
            The first person to sign in to this workspace is auto-promoted to superuser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> User Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Grant access to your MikroTik Access workspace and choose what each person is allowed to do.
          New users sign up via Google or email on the sign-in page; until you grant a role here they have <strong>read-only</strong> access.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {ROLE_OPTIONS.map((o) => (
          <div key={o.value} className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 font-medium text-sm">
              <o.icon className="h-4 w-4 text-primary" /> {o.label}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{o.help}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-medium">User</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">First seen</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" /> loading users…</td></tr>
            )}
            {list.error && (
              <tr><td colSpan={5} className="p-6 text-center text-destructive">{(list.error as Error).message}</td></tr>
            )}
            {list.data?.users.map((u) => {
              const isMe = me.data?.userId === u.clerkUserId;
              return (
                <tr key={u.clerkUserId} className="border-t border-border hover:bg-accent/30">
                  <td className="p-3">
                    <div className="font-medium">
                      {u.fullName || u.email || u.clerkUserId.slice(0, 12)}
                      {isMe && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">you</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email ?? "—"}</div>
                  </td>
                  <td className="p-3"><RoleBadge role={u.role} /></td>
                  <td className="p-3">
                    {u.disabled ? (
                      <span className="text-xs text-destructive font-medium">disabled</span>
                    ) : (
                      <span className="text-xs text-emerald-700 font-medium">active</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 justify-end">
                      <select
                        value={u.role}
                        disabled={savingId === u.clerkUserId}
                        onChange={(e) => onChangeRole(u, e.target.value as ManagedUser["role"])}
                        className="text-xs bg-background border border-input rounded px-2 py-1"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => onToggleDisabled(u)}
                        disabled={savingId === u.clerkUserId || isMe}
                        title={u.disabled ? "Enable user" : "Disable user"}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
                      >
                        {u.disabled ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.data && list.data.users.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>How sign-up works:</strong> share the app URL with anyone you want to grant access. They sign in
          using Google or email (configured in the workspace Auth pane). They land here as <em>read-only</em>; come back
          to this page to promote them to <em>read/write</em> or <em>superuser</em>.
        </div>
      </div>
    </div>
  );
}
