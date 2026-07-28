import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

/**
 * RevenueCat webhook — the only thing allowed to grant Pro. The app can
 * claim whatever it likes; entitlement changes only when RevenueCat tells
 * us, over a channel authenticated by a shared secret we configure in the
 * RC dashboard.
 */
const eventBody = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    product_id: z.string().optional(),
  }),
});

/**
 * Grant on anything that means "they have access now". Note CANCELLATION is
 * deliberately absent: in RevenueCat it means auto-renew was switched off,
 * not that access ended — the user keeps Pro until EXPIRATION arrives. A
 * naive implementation that revokes on CANCELLATION robs a paying customer
 * of the rest of the month they bought.
 */
const GRANTING_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);

/** Access is genuinely over. */
const REVOKING_EVENTS = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED", "REFUND"]);

/** One-off purchase: lifetime, never expires. */
const LIFETIME_EVENTS = new Set(["NON_RENEWING_PURCHASE"]);

export const webhookRoutes = new Hono().post("/revenuecat", async (c) => {
  // The Authorization header value is set by us in the RC dashboard.
  const expected = env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) {
    logger.error("revenuecat webhook hit but REVENUECAT_WEBHOOK_AUTH is unset");
    return c.json({ error: { code: "not_configured", message: "Not configured." } }, 503);
  }
  if (c.req.header("authorization") !== expected) {
    logger.warn("revenuecat webhook rejected: bad authorization header");
    return c.json({ error: { code: "unauthorised", message: "No." } }, 401);
  }

  const parsed = eventBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Unrecognised payload." } }, 400);
  }

  const { type, app_user_id, expiration_at_ms } = parsed.data.event;
  const db = await getDb();

  // We use our own user UUID as the RevenueCat app user id.
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, app_user_id))
    .limit(1);

  if (!user) {
    // 200 so RevenueCat stops retrying a permanently unresolvable event
    // (e.g. the account was deleted). Logged for investigation.
    logger.warn({ type, app_user_id }, "revenuecat event for unknown user");
    return c.json({ ok: true, ignored: "unknown_user" });
  }

  if (LIFETIME_EVENTS.has(type)) {
    await db
      .update(schema.users)
      .set({ entitlement: "lifetime", entitlementExpiresAt: null, revenuecatId: app_user_id })
      .where(eq(schema.users.id, user.id));
  } else if (GRANTING_EVENTS.has(type)) {
    await db
      .update(schema.users)
      .set({
        entitlement: "pro",
        entitlementExpiresAt: expiration_at_ms ? new Date(expiration_at_ms) : null,
        revenuecatId: app_user_id,
      })
      .where(eq(schema.users.id, user.id));
  } else if (REVOKING_EVENTS.has(type)) {
    await db
      .update(schema.users)
      .set({ entitlement: "free", entitlementExpiresAt: null })
      .where(eq(schema.users.id, user.id));
  } else {
    // CANCELLATION, BILLING_ISSUE, TRANSFER etc. — acknowledged, no change.
    logger.info({ type, userId: user.id }, "revenuecat event acknowledged, no entitlement change");
    return c.json({ ok: true, ignored: type });
  }

  logger.info({ type, userId: user.id }, "entitlement updated from revenuecat");
  return c.json({ ok: true });
});
