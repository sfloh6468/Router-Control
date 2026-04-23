import { useQuery } from "@tanstack/react-query";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export type Me = {
  userId: string;
  email: string | null;
  role: "superuser" | "read_write" | "read_only";
  canWrite: boolean;
  isSuper: boolean;
};

export function useMe() {
  return useQuery<Me>({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const r = await fetch(`${apiBase}/api/admin/me`);
      if (!r.ok) throw new Error("not signed in");
      return r.json();
    },
    staleTime: 60_000,
  });
}

export type ManagedUser = {
  clerkUserId: string;
  email: string | null;
  fullName: string | null;
  role: "superuser" | "read_write" | "read_only";
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useUsersList(enabled: boolean) {
  return useQuery<{ users: ManagedUser[] }>({
    queryKey: ["admin", "users"],
    enabled,
    queryFn: async () => {
      const r = await fetch(`${apiBase}/api/admin/users`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
}

export async function updateUser(
  clerkUserId: string,
  patch: { role?: ManagedUser["role"]; disabled?: boolean },
): Promise<void> {
  const r = await fetch(`${apiBase}/api/admin/users/${encodeURIComponent(clerkUserId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${r.status}`);
  }
}
