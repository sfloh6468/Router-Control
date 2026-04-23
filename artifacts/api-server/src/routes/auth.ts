import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, appUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AUTH_COOKIE, requireUser, signAuthToken } from "../middlewares/requireAuth";

const router: IRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const rows = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.username, String(username).trim().toLowerCase()))
    .limit(1);
  const u = rows[0];

  // Use bcrypt.compare on a dummy hash if user not found, to keep timing similar.
  const okPwd = u
    ? await bcrypt.compare(password, u.passwordHash)
    : (await bcrypt.compare(password, "$2a$10$CwTycUXWue0Thq9StjUM0uJ8tBQp7wXL3yQ6mL3lH2qZyZqeOZXkW"), false);

  if (!u || !okPwd) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  if (u.disabled === "true") {
    res.status(403).json({ error: "Account is disabled. Contact your administrator." });
    return;
  }

  const token = signAuthToken({ sub: u.id, username: u.username });
  res.cookie(AUTH_COOKIE, token, COOKIE_OPTS);
  res.json({
    ok: true,
    user: {
      id: u.id,
      username: u.username,
      role: u.role,
      email: u.email,
      fullName: u.fullName,
    },
  });
});

router.post("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.json({ ok: true });
});

router.get("/auth/me", requireUser, (req: Request, res: Response) => {
  res.json({
    userId: req.userId,
    username: req.userUsername,
    email: req.userEmail,
    role: req.userRole,
    canWrite: req.userRole === "read_write" || req.userRole === "superuser",
    isSuper: req.userRole === "superuser",
  });
});

router.post(
  "/auth/change-password",
  requireUser,
  async (req: Request, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      res.status(400).json({ error: "currentPassword and newPassword (min 4 chars) required" });
      return;
    }
    const rows = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, req.userId!))
      .limit(1);
    const u = rows[0];
    if (!u) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!(await bcrypt.compare(currentPassword, u.passwordHash))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(appUsersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(appUsersTable.id, req.userId!));
    res.json({ ok: true });
  },
);

export default router;
