import { Router, type IRouter, type Request, type Response } from "express";
import { db, routerProfilesTable, conversationsTable, messagesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireUser } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Upsert a router profile. Called automatically when the user successfully
// connects to a router. Also bumps connection counters and updates identity
// metadata if it changed.
router.post("/profiles/upsert", requireUser, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { host, port, username, identity, routerOs, routerBoard } = req.body as {
    host?: string;
    port?: number;
    username?: string;
    identity?: string | null;
    routerOs?: string | null;
    routerBoard?: string | null;
  };

  if (!host || !username) {
    res.status(400).json({ error: "host and username required" });
    return;
  }

  const existing = await db
    .select()
    .from(routerProfilesTable)
    .where(and(eq(routerProfilesTable.ownerUserId, userId), eq(routerProfilesTable.host, host)))
    .limit(1);

  let profile;
  if (existing[0]) {
    const updated = await db
      .update(routerProfilesTable)
      .set({
        port: port ?? existing[0].port,
        username,
        identity: identity ?? existing[0].identity,
        routerOs: routerOs ?? existing[0].routerOs,
        routerBoard: routerBoard ?? existing[0].routerBoard,
        lastConnectedAt: new Date(),
        connectionCount: existing[0].connectionCount + 1,
      })
      .where(eq(routerProfilesTable.id, existing[0].id))
      .returning();
    profile = updated[0];
  } else {
    const inserted = await db
      .insert(routerProfilesTable)
      .values({
        ownerUserId: userId,
        host,
        port,
        username,
        identity: identity ?? null,
        routerOs: routerOs ?? null,
        routerBoard: routerBoard ?? null,
      })
      .returning();
    profile = inserted[0];
  }

  res.json({ profile });
});

// List all router profiles owned by the user.
router.get("/profiles", requireUser, async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(routerProfilesTable)
    .where(eq(routerProfilesTable.ownerUserId, req.userId!))
    .orderBy(desc(routerProfilesTable.lastConnectedAt));
  res.json({ profiles: rows });
});

// Update notes / trending data on a profile.
router.patch("/profiles/:id", requireUser, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const { notes, trendingData } = req.body as { notes?: string; trendingData?: Record<string, unknown> };

  const updates: any = {};
  if (notes !== undefined) updates.notes = notes;
  if (trendingData !== undefined) updates.trendingData = trendingData;
  if (Object.keys(updates).length === 0) { res.json({ ok: true }); return; }

  const result = await db
    .update(routerProfilesTable)
    .set(updates)
    .where(and(eq(routerProfilesTable.id, id), eq(routerProfilesTable.ownerUserId, req.userId!)))
    .returning();
  if (result.length === 0) { res.status(404).json({ error: "profile not found" }); return; }
  res.json({ profile: result[0] });
});

// ─────────────────────────── CONVERSATIONS ───────────────────────────

// List conversations, optionally filtered by router profile.
router.get("/conversations", requireUser, async (req: Request, res: Response): Promise<void> => {
  const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;

  const conds = [eq(conversationsTable.ownerUserId, req.userId!)];
  if (profileId !== undefined && Number.isFinite(profileId)) {
    conds.push(eq(conversationsTable.routerProfileId, profileId));
  }

  const rows = await db
    .select({
      id: conversationsTable.id,
      title: conversationsTable.title,
      routerProfileId: conversationsTable.routerProfileId,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      messageCount: sql<number>`(select count(*) from messages where conversation_id = ${conversationsTable.id})::int`,
    })
    .from(conversationsTable)
    .where(and(...conds))
    .orderBy(desc(conversationsTable.updatedAt))
    .limit(100);

  res.json({ conversations: rows });
});

// Create a new conversation.
router.post("/conversations", requireUser, async (req: Request, res: Response): Promise<void> => {
  const { routerProfileId, title } = req.body as { routerProfileId?: number; title?: string };
  const inserted = await db
    .insert(conversationsTable)
    .values({
      ownerUserId: req.userId!,
      routerProfileId: routerProfileId ?? null,
      title: title ?? null,
    })
    .returning();
  res.json({ conversation: inserted[0] });
});

// Get a conversation with all its messages.
router.get("/conversations/:id", requireUser, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const conv = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.ownerUserId, req.userId!)))
    .limit(1);
  if (!conv[0]) { res.status(404).json({ error: "not found" }); return; }
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt);
  res.json({ conversation: conv[0], messages: msgs });
});

// Delete a conversation.
router.delete("/conversations/:id", requireUser, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  // Verify ownership BEFORE deleting any messages — without this guard any
  // signed-in user could erase another user's messages by guessing the id.
  const owned = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.ownerUserId, req.userId!)))
    .limit(1);
  if (owned.length === 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
  await db
    .delete(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.ownerUserId, req.userId!)));
  res.json({ ok: true });
});

export default router;
