import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, messagesTable } from "@workspace/db";
import { ListMessagesParams, CreateMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions/:id/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, params.data.id))
    .orderBy(messagesTable.createdAt);

  res.json(
    messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      type: m.type,
      mediaUrl: m.mediaUrl ?? null,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      sessionId: parsed.data.sessionId,
      role: parsed.data.role,
      content: parsed.data.content,
      type: parsed.data.type,
      mediaUrl: parsed.data.mediaUrl ?? null,
    })
    .returning();

  res.status(201).json({
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    type: message.type,
    mediaUrl: message.mediaUrl ?? null,
    createdAt: message.createdAt.toISOString(),
  });
});

export default router;
