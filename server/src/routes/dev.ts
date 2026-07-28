import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb, schema } from "../db/client.js";

/**
 * Development-only entitlement switch, so the paywall and Pro-gated UI can
 * be exercised end to end in Expo Go where RevenueCat's native module can't
 * run.
 *
 * SAFETY: app.ts mounts this only when NODE_ENV !== "production", so it does
 * not exist on the deployed API. If you ever find yourself tempted to make
 * an exception to that, don't — it's a "make yourself Pro" button.
 */
const body = z.object({ entitlement: z.enum(["free", "pro", "lifetime"]) });

export const devRoutes = new Hono<AuthEnv>()
  .use("*", requireAuth)
  .post("/entitlement", async (c) => {
    const parsed = body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "bad_request", message: "Send { entitlement: free|pro|lifetime }." } },
        400,
      );
    }
    const user = c.get("user");
    const db = await getDb();
    await db
      .update(schema.users)
      .set({ entitlement: parsed.data.entitlement, entitlementExpiresAt: null })
      .where(eq(schema.users.id, user.id));
    return c.json({ ok: true, entitlement: parsed.data.entitlement });
  });
