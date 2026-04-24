import React, { useState } from "react";
import { Users, RefreshCw, Plus, Trash2, X, KeyRound, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useOltUsers,
  useOltAddUser,
  useOltDeleteUser,
  useOltChangeUserPassword,
  useOltPasswordPolicy,
  useOltSetPasswordPolicy,
  type OltUserLevel,
} from "@/hooks/use-olt";
import { useMe } from "@/hooks/use-admin";
import { toast } from "sonner";

const LEVELS: OltUserLevel[] = ["common-user", "operator", "administrator"];
const MODIFY_MODES = ["forced", "recommended", "none"] as const;

const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
const PW_RE = /^[\x21-\x7E]{6,64}$/;

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  const l = level.toLowerCase();
  const cls = l.includes("admin")
    ? "bg-primary/15 text-primary border-primary/30"
    : l.includes("operator")
    ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
    : "bg-slate-500/15 text-slate-700 border-slate-500/30";
  return (
    <span className={"inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border " + cls}>
      {level}
    </span>
  );
}

export default function OltUsersPage() {
  const me = useMe();
  const canWrite = me.data?.canWrite === true;

  const usersQ = useOltUsers();
  const policyQ = useOltPasswordPolicy();
  const addM = useOltAddUser();
  const delM = useOltDeleteUser();
  const pwM = useOltChangeUserPassword();
  const setPolicyM = useOltSetPasswordPolicy();

  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [pwTarget, setPwTarget] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  const [form, setForm] = useState({
    name: "",
    newPassword: "",
    level: "common-user" as OltUserLevel,
    profile: "root",
    appendInfo: "",
    reenterNum: "4",
  });

  const [policyForm, setPolicyForm] = useState({
    minLength: "",
    agingDays: "",
    modifyMode: "" as "" | (typeof MODIFY_MODES)[number],
  });

  const users = usersQ.data?.users ?? [];
  const policy = policyQ.data?.policy;

  const onAdd = async () => {
    if (!NAME_RE.test(form.name)) {
      toast.error("Username must be 1–32 chars: letters, digits, _ or -");
      return;
    }
    if (!PW_RE.test(form.newPassword)) {
      toast.error("Password must be 6–64 printable ASCII chars (no spaces)");
      return;
    }
    try {
      const r = await addM.mutateAsync({
        name: form.name,
        newPassword: form.newPassword,
        level: form.level,
        profile: form.profile || undefined,
        appendInfo: form.appendInfo || undefined,
        reenterNum: form.reenterNum ? Number(form.reenterNum) : undefined,
      });
      if (r.success) {
        toast.success(`User ${form.name} added`);
        setShowAdd(false);
        setForm({ ...form, name: "", newPassword: "", appendInfo: "" });
      } else {
        toast.error(r.error || r.output || "OLT rejected the command");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    }
  };

  const onDelete = async (name: string) => {
    try {
      const r = await delM.mutateAsync(name);
      if (r.success) toast.success(`User ${name} deleted`);
      else toast.error(r.error || r.output || "Delete failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setConfirmDel(null);
    }
  };

  const onChangePw = async () => {
    if (!pwTarget) return;
    if (!PW_RE.test(newPw)) {
      toast.error("Password must be 6–64 printable ASCII chars (no spaces)");
      return;
    }
    try {
      const r = await pwM.mutateAsync({ name: pwTarget, newPassword: newPw });
      if (r.success) {
        toast.success(`Password changed for ${pwTarget}`);
        setPwTarget(null);
        setNewPw("");
      } else {
        toast.error(r.error || r.output || "Password change failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Password change failed");
    }
  };

  const onSavePolicy = async () => {
    const payload: Parameters<typeof setPolicyM.mutateAsync>[0] = {};
    if (policyForm.minLength) payload.minLength = Number(policyForm.minLength);
    if (policyForm.agingDays) payload.agingDays = Number(policyForm.agingDays);
    if (policyForm.modifyMode) payload.modifyMode = policyForm.modifyMode;
    if (Object.keys(payload).length === 0) {
      toast.error("Set at least one policy field");
      return;
    }
    try {
      const r = await setPolicyM.mutateAsync(payload);
      if (r.success) {
        toast.success("Password policy updated");
        setPolicyForm({ minLength: "", agingDays: "", modifyMode: "" });
      } else {
        toast.error(r.output || "Policy update failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Policy update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            OLT Users
          </h1>
          <p className="text-muted-foreground mt-1">
            {users.length} CLI accounts · display terminal user all
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => usersQ.refetch()} disabled={usersQ.isFetching}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (usersQ.isFetching ? "animate-spin" : "")} />
            Refresh
          </Button>
          {canWrite && (
            <Button onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {showAdd ? "Cancel" : "Add User"}
            </Button>
          )}
        </div>
      </div>

      {!canWrite && (
        <Card className="p-3 bg-muted/40 text-xs text-muted-foreground">
          You have read-only access. Sign in as a writer or superuser to add, delete, or change passwords.
        </Card>
      )}

      {usersQ.isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
          {usersQ.error instanceof Error ? usersQ.error.message : "Failed to load users"}
        </Card>
      )}

      {showAdd && canWrite && (
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            New OLT user
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Username" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field
              label="New password"
              value={form.newPassword}
              onChange={(v) => setForm({ ...form, newPassword: v })}
              type="password"
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as OltUserLevel })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-mono"
              >
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <Field label="Profile" value={form.profile} onChange={(v) => setForm({ ...form, profile: v })} />
            <Field
              label="Append info"
              value={form.appendInfo}
              onChange={(v) => setForm({ ...form, appendInfo: v })}
            />
            <Field
              label="Re-enter num"
              value={form.reenterNum}
              onChange={(v) => setForm({ ...form, reenterNum: v })}
            />
          </div>
          <div className="text-xs text-muted-foreground font-mono bg-black/40 text-slate-200 p-3 rounded-lg">
            (config)# terminal user name {form.name || "&lt;name&gt;"}  [interactive: password / level / profile / append-info / reenter-num]
          </div>
          <div className="flex justify-end">
            <Button onClick={onAdd} disabled={addM.isPending}>
              {addM.isPending ? "Adding…" : "Create user"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Username</th>
                <th className="px-3 py-2 text-left">Level</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Re-enter</th>
                <th className="px-3 py-2 text-left">Profile</th>
                <th className="px-3 py-2 text-left">Append info</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQ.isLoading && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!usersQ.isLoading && users.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No users found.</td></tr>
              )}
              {users.map((u) => {
                const isPwTarget = pwTarget === u.name;
                return (
                  <React.Fragment key={u.name}>
                    <tr className="border-t border-border/40 hover:bg-accent/30">
                      <td className="px-3 py-2 font-mono text-xs">{u.name}</td>
                      <td className="px-3 py-2"><LevelBadge level={u.level} /></td>
                      <td className="px-3 py-2 text-xs">{u.status ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{u.reenterNum ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{u.profile ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{u.appendInfo ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {canWrite ? (
                          <div className="inline-flex items-center gap-3">
                            <button
                              onClick={() => { setPwTarget(isPwTarget ? null : u.name); setNewPw(""); }}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              title="Change password"
                            >
                              <KeyRound className="h-3 w-3" /> Password
                            </button>
                            {confirmDel === u.name ? (
                              <span className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => onDelete(u.name)}
                                  disabled={delM.isPending}
                                  className="text-xs text-destructive hover:underline"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDel(null)}
                                  className="text-xs text-muted-foreground hover:underline"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDel(u.name)}
                                className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">read-only</span>
                        )}
                      </td>
                    </tr>
                    {isPwTarget && (
                      <tr className="bg-accent/20">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                New password for {u.name}
                              </label>
                              <Input
                                type="password"
                                value={newPw}
                                onChange={(e) => setNewPw(e.target.value)}
                                className="font-mono w-72"
                              />
                            </div>
                            <Button onClick={onChangePw} disabled={pwM.isPending}>
                              {pwM.isPending ? "Updating…" : "Update password"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => { setPwTarget(null); setNewPw(""); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Password policy
          </h2>
          <Button variant="ghost" size="sm" onClick={() => policyQ.refetch()} disabled={policyQ.isFetching}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (policyQ.isFetching ? "animate-spin" : "")} />
            Reload
          </Button>
        </div>

        {policyQ.isError && (
          <div className="text-sm text-destructive">
            {policyQ.error instanceof Error ? policyQ.error.message : "Failed to load policy"}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PolicyMetric label="Min length" value={policy?.minLength ?? null} />
          <PolicyMetric label="Aging (days)" value={policy?.agingDays ?? null} />
          <PolicyMetric label="Modify mode" value={policy?.modifyMode ?? null} />
          <PolicyMetric label="Complexity" value={policy?.complexity ?? null} />
        </div>

        {canWrite && (
          <div className="border-t border-border/40 pt-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Update policy
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field
                label="Min length (1–32)"
                value={policyForm.minLength}
                onChange={(v) => setPolicyForm({ ...policyForm, minLength: v })}
              />
              <Field
                label="Aging days (0–999)"
                value={policyForm.agingDays}
                onChange={(v) => setPolicyForm({ ...policyForm, agingDays: v })}
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Modify mode
                </label>
                <select
                  value={policyForm.modifyMode}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      modifyMode: e.target.value as typeof policyForm.modifyMode,
                    })
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-mono"
                >
                  <option value="">(unchanged)</option>
                  {MODIFY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onSavePolicy} disabled={setPolicyM.isPending}>
                {setPolicyM.isPending ? "Saving…" : "Apply policy"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {usersQ.data?.raw && (
        <Card className="p-5 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raw output</h2>
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed bg-black/40 text-slate-200 p-4 rounded-lg max-h-72 overflow-auto">
            {usersQ.data.raw}
          </pre>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
      />
    </div>
  );
}

function PolicyMetric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-md border border-border/60 bg-accent/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value === null || value === "" ? "—" : value}</div>
    </div>
  );
}
