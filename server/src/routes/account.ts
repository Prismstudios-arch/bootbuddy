import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb, schema } from "../db/client.js";
import { getQuota } from "../services/quota.js";
import { computeStats } from "../services/stats.js";

/**
 * Mounted at the `/v1` root, so auth is attached per route rather than with
 * `use("*")` — a wildcard here would also fire for /v1/finds, /v1/scan and
 * every other sub-router, running the user lookup twice on every request.
 */
export const accountRoutes = new Hono<AuthEnv>()
  /** Who am I + live quota — the app's session bootstrap call. */
  .get("/me", requireAuth, async (c) => {
    const user = c.get("user");
    const db = await getDb();
    return c.json({
      user: { id: user.id, entitlement: user.entitlement },
      quota: await getQuota(db, user),
    });
  })

  /** Profit dashboard aggregates — computed server-side, one source of truth. */
  .get("/stats", requireAuth, async (c) => {
    const user = c.get("user");
    const db = await getDb();
    return c.json({ stats: await computeStats(db, user.id) });
  })

  /**
   * DELETE /v1/account — App Review 5.1.1(v). Hard delete: the user row goes
   * and every child row (scans, finds, usage, refresh tokens) cascades with
   * it. Nothing to anonymise because we never stored photos or emails for
   * anonymous accounts.
   */
  .delete("/account", requireAuth, async (c) => {
    const user = c.get("user");
    const db = await getDb();
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
    return c.json({ ok: true, message: "Account and all data deleted. Happy hunting." });
  });
