import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, type AuthRole } from "@/lib/auth-context";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export type Me = {
  userId: string;
  username: string;
  email: string | null;
  role: AuthRole;
  canWrite: boolean;
  isSuper: boolean;
};

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  role: AuthRole;
  disabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// Returns the auth-context user remapped into the older `Me` shape so the
// rest of the app keeps working unchanged.
export function useMe() {
  const { user, loading } = useAuth();
  return {
    data: user as Me | null,
    isLoading: loading,
  };
}

async function fetchUsers(): Promise<AdminUser[]> {
  const r = await fetch(`${apiBase}/api/admin/users`, { credentials: "include" });
  if (!r.ok) throw new Error(`Failed to load users: ${r.status}`);
  const j = await r.json();
  return j.users as AdminUser[];
}

export function useUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: fetchUsers });
}

export type UpdatePayload = {
  role?: AuthRole;
  disabled?: boolean;
  password?: string;
};

async function updateUserApi(id: string, body: UpdatePayload) {
  const r = await fetch(`${apiBase}/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Update failed: ${r.status}`);
  }
  return r.json();
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePayload }) =>
      updateUserApi(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export type CreatePayload = {
  username: string;
  password: string;
  role: AuthRole;
  fullName?: string;
  email?: string;
};

async function createUserApi(body: CreatePayload) {
  const r = await fetch(`${apiBase}/api/admin/users`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Create failed: ${r.status}`);
  }
  return r.json();
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUserApi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

async function deleteUserApi(id: string) {
  const r = await fetch(`${apiBase}/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Delete failed: ${r.status}`);
  }
  return r.json();
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteUserApi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}
