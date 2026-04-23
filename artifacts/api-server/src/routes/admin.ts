import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, appUsersTable, type AppUserRole } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireSuper } from "../middlewares/requireAuth";

const router: IRouter = Router();

const VALID_ROLES: AppUserRole[] = ["read_write", "read_only"]; // creatable via UI
const ALL_ROLES: AppUserRole[] = ["superuser", "read_write", "read_only"];

function newUserId(): string {
  return `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

router.get("/admin/users", ...requireSuper(), async (_req, res) => {
  const rows = await db
    .select()
    .from(appUsersTable)
    .orderBy(desc(appUsersTable.createdAt));
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      fullName: r.fullName,
      role: r.role as AppUserRole,
      disabled: r.disabled === "true",
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
});

// Create new member account — superuser only.
router.post(
  "/admin/users",
  ...requireSuper(),
  async (req: Request, res: Response): Promise<void> => {
    const { username, password, role, fullName, email } = req.body as {
      username?: string;
      password?: string;
      role?: string;
      fullName?: string;
      email?: string;
    };
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    const uname = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(uname)) {
      res.status(400).json({
        error:
          "username must be 3–32 chars and contain only letters, digits, '.', '_' or '-'",
      });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: "password must be at least 4 characters" });
      return;
    }
    const r = (role as AppUserRole) || "read_only";
    if (!VALID_ROLES.includes(r)) {
      res
        .status(400)
        .json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
      return;
    }

    const exists = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.username, uname))
      .limit(1);
    if (exists[0]) {
      res.status(409).json({ error: "username already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db
      .insert(appUsersTable)
      .values({
        id: newUserId(),
        username: uname,
        passwordHash,
        role: r,
        fullName: fullName || null,
        email: email || null,
        createdBy: req.userId!,
      })
      .returning();
    res.json({ ok: true, user: { ...inserted[0], passwordHash: undefined } });
  },
);

// Update an existing user (role / disabled / reset password).
router.patch(
  "/admin/users/:id",
  ...requireSuper(),
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const { role, disabled, password } = req.body as {
      role?: string;
      disabled?: boolean;
      password?: string;
    };

    const updates: {
      role?: AppUserRole;
      disabled?: string;
      passwordHash?: string;
      updatedAt?: Date;
    } = { updatedAt: new Date() };

    if (role !== undefined) {
      if (!ALL_ROLES.includes(role as AppUserRole)) {
        res
          .status(400)
          .json({ error: `Invalid role. Must be one of: ${ALL_ROLES.join(", ")}` });
        return;
      }
      updates.role = role as AppUserRole;
    }
    if (disabled !== undefined) {
      updates.disabled = disabled ? "true" : "false";
    }
    if (password !== undefined) {
      if (password.length < 4) {
        res.status(400).json({ error: "password must be at least 4 characters" });
        return;
      }
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    // Don't let the only superuser demote or disable themselves.
    if (req.userId === id) {
      const supers = await db
        .select()
        .from(appUsersTable)
        .where(eq(appUsersTable.role, "superuser"));
      const onlySuper = supers.length <= 1;
      if (onlySuper && updates.role && updates.role !== "superuser") {
        res
          .status(400)
          .json({ error: "Cannot demote yourself — you are the only superuser." });
        return;
      }
      if (updates.disabled === "true") {
        res.status(400).json({ error: "Cannot disable your own account." });
        return;
      }
    }

    const result = await db
      .update(appUsersTable)
      .set(updates)
      .where(eq(appUsersTable.id, id))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ ok: true, user: { ...result[0], passwordHash: undefined } });
  },
);

// Delete a user. Cannot delete yourself.
router.delete(
  "/admin/users/:id",
  ...requireSuper(),
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    if (id === req.userId) {
      res.status(400).json({ error: "Cannot delete your own account." });
      return;
    }
    const target = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, id))
      .limit(1);
    if (!target[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target[0].role === "superuser") {
      const supers = await db
        .select()
        .from(appUsersTable)
        .where(eq(appUsersTable.role, "superuser"));
      if (supers.length <= 1) {
        res.status(400).json({ error: "Cannot delete the only superuser." });
        return;
      }
    }
    await db.delete(appUsersTable).where(eq(appUsersTable.id, id));
    res.json({ ok: true });
  },
);

export default router;
