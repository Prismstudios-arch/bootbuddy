import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyAppleIdentityToken } from "../auth/apple.js";
import { signAccessToken, verifyAccessToken } from "../auth/jwt.js";
import { issueRefreshToken, rotateRefreshToken } from "../auth/tokens.js";
import { getDb, schema } from "../db/client.js";

const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });
const appleBody = z.object({ identityToken: z.string().min(20).max(8192) });

async function sessionFor(userId: string, entitlement: string) {
  const db = await getDb();
  return {
    accessToken: await signAccessToken(userId),
    refreshToken: await issueRefreshToken(db, userId),
    user: { id: userId, entitlement },
  };
}

export const authRoutes = new Hono()
  /**
   * Anonymous device account — created silently on first launch so the app
   * works before (or without) Sign in with Apple. No body needed.
   */
  .post("/anonymous", async (c) => {
    const db = await getDb();
    const [user] = await db
      .insert(schema.users)
      .values({})
      .returning({ id: schema.users.id, entitlement: schema.users.entitlement });
    if (!user) throw new Error("user insert returned nothing");
    return c.json(await sessionFor(user.id, user.entitlement), 201);
  })

  .post("/refresh", async (c) => {
    const parsed = refreshBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "bad_request", message: "Send { refreshToken }." } }, 400);
    }
    const db = await getDb();
    const result = await rotateRefreshToken(db, parsed.data.refreshToken);
    if (!result.ok) {
      return c.json(
        { error: { code: "invalid_refresh", message: "Session expired — sign in again." } },
        401,
      );
    }
    return c.json({
      accessToken: await signAccessToken(result.userId),
      refreshToken: result.refreshToken,
    });
  })

  /**
   * Sign in with Apple. Links the Apple identity to the caller's existing
   * anonymous account when a valid Bearer token accompanies the request
   * (keeps their scans/finds); otherwise finds-or-creates by Apple sub.
   */
  .post("/apple", async (c) => {
    const parsed = appleBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "bad_request", message: "Send { identityToken }." } }, 400);
    }
    const identity = await verifyAppleIdentityToken(parsed.data.identityToken);
    if (!identity) {
      return c.json(
        { error: { code: "invalid_apple_token", message: "Apple didn't recognise that sign-in." } },
        401,
      );
    }

    const db = await getDb();
    const [existing] = await db
      .select({ id: schema.users.id, entitlement: schema.users.entitlement })
      .from(schema.users)
      .where(eq(schema.users.appleSub, identity.sub))
      .limit(1);
    if (existing) {
      return c.json(await sessionFor(existing.id, existing.entitlement));
    }

    // Link to the current anonymous account if one was presented.
    const header = c.req.header("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const currentUserId = bearer ? await verifyAccessToken(bearer) : null;
    if (currentUserId) {
      const [linked] = await db
        .update(schema.users)
        .set({ appleSub: identity.sub })
        .where(eq(schema.users.id, currentUserId))
        .returning({ id: schema.users.id, entitlement: schema.users.entitlement });
      if (linked) return c.json(await sessionFor(linked.id, linked.entitlement));
    }

    const [created] = await db
      .insert(schema.users)
      .values({ appleSub: identity.sub })
      .returning({ id: schema.users.id, entitlement: schema.users.entitlement });
    if (!created) throw new Error("user insert returned nothing");
    return c.json(await sessionFor(created.id, created.entitlement), 201);
  });
