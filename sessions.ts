import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, messagesTable } from "@workspace/db";
import {
  ListSessionsQueryParams,
  CreateSessionBody,
  DeleteSessionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (req, res): Promise<void> => {
  const parsed = ListSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.username, parsed.data.username))
    .orderBy(sessionsTable.updatedAt);

  res.json(
    sessions.map((s) => ({
      id: s.id,
      username: s.username,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
});

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({ username: parsed.data.username, title: parsed.data.title })
    .returning();

  res.status(201).json({
    id: session.id,
    username: session.username,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const params = DeleteSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(messagesTable).where(eq(messagesTable.sessionId, params.data.id));
  const [deleted] = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
