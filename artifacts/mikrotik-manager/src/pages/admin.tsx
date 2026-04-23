import { useState, type FormEvent } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Pencil,
  UserX,
  UserCheck,
  Loader2,
  AlertTriangle,
  UserPlus,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  useMe,
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type AdminUser,
} from "@/hooks/use-admin";
import type { AuthRole } from "@/lib/auth-context";

const ROLE_OPTIONS: Array<{
  value: AuthRole;
  label: string;
  icon: React.ComponentType<any>;
  help: string;
}> = [
  { value: "read_only", label: "Read-only", icon: Eye, help: "Can connect & read state. Cannot change router config." },
  { value: "read_write", label: "Read / write", icon: Pencil, help: "Can connect, read, and run mutating commands." },
  { value: "superuser", label: "Superuser", icon: ShieldAlert, help: "Full admin including managing user accounts." },
];

const CREATABLE_ROLES: AuthRole[] = ["read_only", "read_write"];

function RoleBadge({ role }: { role: AuthRole }) {
  const opt = ROLE_OPTIONS.find((o) => o.value === role)!;
  const Icon = opt.icon;
  const cls =
    role === "superuser"
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

function CreateUserForm() {
  const create = useCreateUser();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthRole>("read_only");
  const [fullName, setFullName] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        username: username.trim(),
        password,
        role,
        fullName: fullName.trim() || undefined,
      });
      toast.success(`Created ${username} (${role})`);
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("read_only");
    } catch (e: any) {
      toast.error(e?.message || "Could not create user");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="flex items-center gap-2 font-semibold text-sm">
        <UserPlus className="h-4 w-4 text-primary" /> Create new member
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="e.g. alice"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            placeholder="At least 4 characters"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Full name (optional)</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alice Smith"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AuthRole)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {CREATABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_OPTIONS.find((o) => o.value === r)!.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={create.isPending}
        className="rounded-md bg-primary text-primary-foreground font-semibold px-4 py-2 text-sm hover:bg-primary/90 disabled:opacity-60 inline-flex items-center gap-2"
      >
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create user
      </button>
    </form>
  );
}

function ResetPasswordButton({ user }: { user: AdminUser }) {
  const update = useUpdateUser();
  return (
    <button
      title="Reset password"
      onClick={async () => {
        const pw = window.prompt(`Enter a new password for "${user.username}":`);
        if (!pw) return;
        try {
          await update.mutateAsync({ id: user.id, body: { password: pw } });
          toast.success(`Password reset for ${user.username}`);
        } catch (e: any) {
          toast.error(e?.message || "Reset failed");
        }
      }}
      disabled={update.isPending}
      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
    >
      <KeyRound className="h-4 w-4" />
    </button>
  );
}

export default function AdminPage() {
  const me = useMe();
  const list = useUsers();
  const update = useUpdateUser();
  const del = useDeleteUser();
  const [savingId, setSavingId] = useState<string | null>(null);

  const onChangeRole = async (u: AdminUser, role: AuthRole) => {
    if (role === u.role) return;
    setSavingId(u.id);
    try {
      await update.mutateAsync({ id: u.id, body: { role } });
      toast.success(`Updated ${u.username} → ${role}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const onToggleDisabled = async (u: AdminUser) => {
    setSavingId(u.id);
    try {
      await update.mutateAsync({ id: u.id, body: { disabled: !u.disabled } });
      toast.success(u.disabled ? "User enabled" : "User disabled");
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const onDelete = async (u: AdminUser) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    setSavingId(u.id);
    try {
      await del.mutateAsync(u.id);
      toast.success(`Deleted ${u.username}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    } finally {
      setSavingId(null);
    }
  };

  if (me.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!me.data?.isSuper) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <h2 className="font-semibold">Superuser only</h2>
          <p className="text-sm mt-1">
            Your role is <strong>{me.data?.role ?? "unknown"}</strong>. Only superusers can manage user accounts.
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
          Create accounts for your team and pick what each person can do. New users sign in with the username and password you set here.
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

      <CreateUserForm />

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-medium">User</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Created</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> loading users…
                </td>
              </tr>
            )}
            {list.error && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-destructive">
                  {(list.error as Error).message}
                </td>
              </tr>
            )}
            {list.data?.map((u) => {
              const isMe = me.data?.userId === u.id;
              return (
                <tr key={u.id} className="border-t border-border hover:bg-accent/30">
                  <td className="p-3">
                    <div className="font-medium">
                      {u.username}
                      {isMe && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">you</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.fullName || u.email || "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    <RoleBadge role={u.role} />
                  </td>
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
                        disabled={savingId === u.id}
                        onChange={(e) => onChangeRole(u, e.target.value as AuthRole)}
                        className="text-xs bg-background border border-input rounded px-2 py-1"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ResetPasswordButton user={u} />
                      <button
                        onClick={() => onToggleDisabled(u)}
                        disabled={savingId === u.id || isMe}
                        title={u.disabled ? "Enable user" : "Disable user"}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
                      >
                        {u.disabled ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => onDelete(u)}
                        disabled={savingId === u.id || isMe}
                        title="Delete user"
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.data && list.data.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Tip:</strong> use the key icon to reset a member's password if they forget it. Use the user-x icon to suspend an account without deleting it.
        </div>
      </div>
    </div>
  );
}
