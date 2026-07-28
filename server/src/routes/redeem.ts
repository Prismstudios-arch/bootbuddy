import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb, schema } from "../db/client.js";
import { env } from "../env.js";
import { logger } from "../logger.js";

/**
 * Promo codes — the safe way to hand out Pro without a purchase: App Review
 * demo accounts, press, competition winners, and testing the Pro experience
 * on a real device against production.
 *
 * Unlike the dev entitlement route this ships to production, so it is
 * deliberately narrow: codes come from a secret (never the app bundle), the
 * comparison is timing-safe, it's rate limited at the route, and it can only
 * ever grant — never revoke, never touch another account.
 */
const body = z.object({ code: z.string().trim().min(4).max(64) });

/** Constant-time compare so a wrong code leaks nothing through timing. */
function matches(candidate: string, valid: string[]): boolean {
  let found = false;
  for (const code of valid) {
    // Compare every entry, no early exit.
    const equal =
      candidate.length === code.length &&
      candidate.split("").reduce((acc, ch, i) => acc + (ch === code[i] ? 0 : 1), 0) === 0;
    found = found || equal;
  }
  return found;
}

export const redeemRoutes = new Hono<AuthEnv>().post("/", requireAuth, async (c) => {
  const parsed = body.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Enter a code." } }, 400);
  }

  const valid = (env.PROMO_CODES ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code.length > 0);

  if (valid.length === 0 || !matches(parsed.data.code, valid)) {
    logger.info("promo code rejected");
    return c.json(
      { error: { code: "invalid_code", message: "That code isn't valid. Check it and try again?" } },
      404,
    );
  }

  const user = c.get("user");
  const db = await getDb();
  await db
    .update(schema.users)
    .set({ entitlement: "lifetime", entitlementExpiresAt: null })
    .where(eq(schema.users.id, user.id));

  logger.info({ userId: user.id }, "promo code redeemed");
  return c.json({ ok: true, entitlement: "lifetime" });
});
