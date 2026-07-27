import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { verifyAccessToken } from "./jwt.js";

export type AuthedUser = {
  id: string;
  entitlement: "free" | "pro" | "lifetime";
  entitlementExpiresAt: Date | null;
};

export type AuthEnv = { Variables: { user: AuthedUser; requestId: string } };

/**
 * Bearer-token gate for every /v1 route. Loads the user row so downstream
 * handlers get entitlement without a second query, and treats deleted
 * accounts as gone (their JWT may still be within its 1h window).
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const userId = token ? await verifyAccessToken(token) : null;

  if (!userId) {
    return c.json(
      { error: { code: "unauthorised", message: "You need to sign in for that." } },
      401,
    );
  }

  const db = await getDb();
  const [user] = await db
    .select({
      id: schema.users.id,
      entitlement: schema.users.entitlement,
      entitlementExpiresAt: schema.users.entitlementExpiresAt,
      deletedAt: schema.users.deletedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user || user.deletedAt !== null) {
    return c.json(
      { error: { code: "unauthorised", message: "That account no longer exists." } },
      401,
    );
  }

  c.set("user", {
    id: user.id,
    entitlement: user.entitlement,
    entitlementExpiresAt: user.entitlementExpiresAt,
  });
  await next();
});
