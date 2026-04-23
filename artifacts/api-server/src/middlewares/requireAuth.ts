import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, appUsersTable, type AppUserRole } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: AppUserRole;
      userEmail?: string | null;
    }
  }
}

// Look up (or create) the AppUser row for this Clerk user. The very first
// user to ever sign in is auto-promoted to "superuser". All subsequent users
// default to "read_only" until a superuser elevates them.
async function ensureAppUser(
  clerkUserId: string,
): Promise<{ role: AppUserRole; email: string | null; disabled: boolean }> {
  const existing = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.clerkUserId, clerkUserId))
    .limit(1);

  if (existing[0]) {
    return {
      role: existing[0].role as AppUserRole,
      email: existing[0].email,
      disabled: existing[0].disabled === "true",
    };
  }

  // Pull email/name from Clerk for nicer UX in the admin panel
  let email: string | null = null;
  let fullName: string | null = null;
  try {
    const cu = await clerkClient.users.getUser(clerkUserId);
    email =
      cu.primaryEmailAddress?.emailAddress ??
      cu.emailAddresses[0]?.emailAddress ??
      null;
    fullName =
      [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim() ||
      cu.username ||
      null;
  } catch {
    // ignore — user will still be created without email/name
  }

  // Atomic check: are there any users at all?
  const countRow = await db.execute(sql`select count(*)::int as n from app_users`);
  const n = (countRow.rows[0] as { n: number } | undefined)?.n ?? 0;
  let role: AppUserRole = n === 0 ? "superuser" : "read_only";

  // Email-continuity rule: if a previous Clerk record with the same email
  // already had elevated privileges, inherit that role on this fresh sign-in.
  // This handles cases where Clerk re-issues a new userId for the same human
  // (e.g. after re-signup, dev↔prod key rotation, or OAuth re-link) so a
  // returning superuser is not silently demoted to read_only.
  if (email && role === "read_only") {
    const sibling = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.email, email))
      .limit(1);
    if (sibling[0]?.role === "superuser" || sibling[0]?.role === "read_write") {
      role = sibling[0].role as AppUserRole;
    }
  }

  await db
    .insert(appUsersTable)
    .values({ clerkUserId, email, fullName, role })
    .onConflictDoNothing();

  return { role, email, disabled: false };
}

export function requireAuth(allowDisabled = false) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = getAuth(req);
    const userId = (auth?.sessionClaims as any)?.userId || auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized — sign in required" });
      return;
    }
    try {
      let { role, email, disabled } = await ensureAppUser(String(userId));
      // Re-sync on every request: if this user's email matches an existing
      // superuser/read_write row, lift this row to that level. This makes
      // post-hoc promotions (e.g. you fixed the previous account) take
      // effect on the very next request without manual DB edits.
      if (email && role === "read_only") {
        const sibling = await db
          .select()
          .from(appUsersTable)
          .where(eq(appUsersTable.email, email))
          .limit(2);
        const elevated = sibling.find(
          (s) => s.clerkUserId !== String(userId) && (s.role === "superuser" || s.role === "read_write"),
        );
        if (elevated) {
          await db
            .update(appUsersTable)
            .set({ role: elevated.role as AppUserRole, updatedAt: new Date() })
            .where(eq(appUsersTable.clerkUserId, String(userId)));
          role = elevated.role as AppUserRole;
        }
      }
      if (disabled && !allowDisabled) {
        res.status(403).json({ error: "Your account has been disabled by an administrator." });
        return;
      }
      req.userId = String(userId);
      req.userRole = role;
      req.userEmail = email;
      next();
    } catch (err) {
      console.error("[requireAuth] db error:", err);
      res.status(500).json({ error: "auth lookup failed" });
    }
  };
}

// Block access unless the user has one of the allowed roles.
export function requireRole(...allowed: AppUserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !allowed.includes(req.userRole)) {
      res.status(403).json({
        error: `Forbidden — requires role: ${allowed.join(" or ")}. Your role: ${req.userRole ?? "none"}.`,
      });
      return;
    }
    next();
  };
}

// Convenience: any logged-in non-disabled user (read_only counts).
export const requireUser = requireAuth();
// Convenience: write capability (read_write or superuser).
export function requireWriter() {
  return [requireAuth(), requireRole("read_write", "superuser")];
}
// Convenience: superuser only.
export function requireSuper() {
  return [requireAuth(), requireRole("superuser")];
}
