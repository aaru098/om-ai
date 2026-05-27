import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, GetUserParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username } = parsed.data;
  const isAdmin = username === "Aarav09";

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing[0]) {
    res.json({
      id: existing[0].id,
      username: existing[0].username,
      isAdmin: existing[0].isAdmin,
      createdAt: existing[0].createdAt.toISOString(),
    });
    return;
  }

  const [user] = await db.insert(usersTable).values({ username, isAdmin }).returning();
  res.json({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/users/:username", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, params.data.username));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
