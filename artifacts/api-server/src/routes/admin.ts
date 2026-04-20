import { Router, type IRouter, type Request, type Response } from "express";
import { db, appUsersTable, type AppUserRole } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireSuper, requireUser } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Anyone signed in can ask "who am I and what can I do?"
router.get("/admin/me", requireUser, (req: Request, res: Response) => {
  res.json({
    userId: req.userId,
    email: req.userEmail,
    role: req.userRole,
    canWrite: req.userRole === "read_write" || req.userRole === "superuser",
    isSuper: req.userRole === "superuser",
  });
});

// List all users — superuser only.
router.get("/admin/users", ...requireSuper(), async (_req, res) => {
  const rows = await db.select().from(appUsersTable).orderBy(desc(appUsersTable.createdAt));
  res.json({
    users: rows.map((r) => ({
      clerkUserId: r.clerkUserId,
      email: r.email,
      fullName: r.fullName,
      role: r.role as AppUserRole,
      disabled: r.disabled === "true",
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
});

const VALID_ROLES: AppUserRole[] = ["superuser", "read_write", "read_only"];

router.patch("/admin/users/:clerkUserId", ...requireSuper(), async (req: Request, res: Response): Promise<void> => {
  const { clerkUserId } = req.params;
  const { role, disabled } = req.body as { role?: string; disabled?: boolean };

  const updates: { role?: AppUserRole; disabled?: string; updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role as AppUserRole)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
      return;
    }
    updates.role = role as AppUserRole;
  }
  if (disabled !== undefined) {
    updates.disabled = disabled ? "true" : "false";
  }

  // Don't allow a superuser to demote themselves if they are the only super
  if (req.userId === clerkUserId && updates.role && updates.role !== "superuser") {
    const supers = await db.select().from(appUsersTable).where(eq(appUsersTable.role, "superuser"));
    if (supers.length <= 1) {
      res.status(400).json({ error: "Cannot demote yourself — you are the only superuser." });
      return;
    }
  }
  if (req.userId === clerkUserId && updates.disabled === "true") {
    res.status(400).json({ error: "Cannot disable your own account." });
    return;
  }

  const result = await db
    .update(appUsersTable)
    .set(updates)
    .where(eq(appUsersTable.clerkUserId, clerkUserId))
    .returning();

  if (result.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ ok: true, user: result[0] });
});

export default router;
