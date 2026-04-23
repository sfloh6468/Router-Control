import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, appUsersTable, type AppUserRole } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: AppUserRole;
      userEmail?: string | null;
      userUsername?: string;
    }
  }
}

export const AUTH_COOKIE = "mt_auth";

let cachedDevSecret: string | null = null;

function getJwtSecret(): string {
  const s = process.env.AUTH_JWT_SECRET || process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;

  // In production we refuse to fall back — a missing/weak secret would let
  // anyone forge auth tokens. Operators must set AUTH_JWT_SECRET (>= 16 chars).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_JWT_SECRET is required in production and must be at least 16 characters. Refusing to start with an insecure secret.",
    );
  }

  // Dev only: generate a strong random secret on first use and cache it for
  // the lifetime of the process. Restarting the server invalidates sessions.
  if (!cachedDevSecret) {
    // Lazy import to avoid pulling crypto into top-level cost.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto") as typeof import("crypto");
    cachedDevSecret = crypto.randomBytes(48).toString("hex");
    // eslint-disable-next-line no-console
    console.warn(
      "[auth] AUTH_JWT_SECRET not set — generated an ephemeral dev secret. Sessions will not survive restarts. Set AUTH_JWT_SECRET to make this stable.",
    );
  }
  return cachedDevSecret;
}

export type AuthTokenPayload = { sub: string; username: string };

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" });
}

function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    if (!decoded?.sub) return null;
    return decoded;
  } catch {
    return null;
  }
}

function readToken(req: Request): string | null {
  const cookieToken = (req as any).cookies?.[AUTH_COOKIE];
  if (cookieToken) return cookieToken as string;
  const auth = req.header("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export function requireAuth(allowDisabled = false) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = readToken(req);
    const payload = token ? verifyAuthToken(token) : null;
    if (!payload) {
      res.status(401).json({ error: "Unauthorized — sign in required" });
      return;
    }

    const rows = await db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, payload.sub))
      .limit(1);
    const u = rows[0];

    if (!u) {
      res.status(401).json({ error: "Unauthorized — user no longer exists" });
      return;
    }

    if (!allowDisabled && u.disabled === "true") {
      res.status(403).json({ error: "Account is disabled. Contact your administrator." });
      return;
    }

    req.userId = u.id;
    req.userRole = u.role as AppUserRole;
    req.userEmail = u.email;
    req.userUsername = u.username;
    next();
  };
}

export function requireRole(...allowed: AppUserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!allowed.includes(req.userRole)) {
      res
        .status(403)
        .json({ error: `Forbidden — requires one of: ${allowed.join(", ")}` });
      return;
    }
    next();
  };
}

// Convenience handler stacks for routes
export const requireUser = requireAuth();
export const requireWriter = () => [requireAuth(), requireRole("superuser", "read_write")];
export const requireSuper = () => [requireAuth(), requireRole("superuser")];
