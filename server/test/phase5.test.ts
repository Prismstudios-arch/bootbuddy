import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { createPgliteDb, schema, setDbForTests, type Db } from "../src/db/client.js";
import { resetRateLimits } from "../src/middleware/rate-limit.js";

// NODE_ENV, JWT_SECRET and REVENUECAT_WEBHOOK_AUTH come from vitest.config.ts.
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  setDbForTests(db);
});

beforeEach(() => {
  resetRateLimits();
});

async function signup(app: ReturnType<typeof createApp>) {
  const res = await app.request("/v1/auth/anonymous", { method: "POST" });
  return (await res.json()) as { accessToken: string; user: { id: string } };
}

function webhook(app: ReturnType<typeof createApp>, event: Record<string, unknown>, auth = "test-webhook-secret") {
  return app.request("/v1/webhooks/revenuecat", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ event }),
  });
}

async function entitlementOf(userId: string) {
  const [row] = await db
    .select({
      entitlement: schema.users.entitlement,
      expiresAt: schema.users.entitlementExpiresAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row;
}

describe("revenuecat webhook", () => {
  it("rejects a request without the shared secret", async () => {
    const app = createApp();
    const { user } = await signup(app);
    const res = await webhook(app, { type: "INITIAL_PURCHASE", app_user_id: user.id }, "wrong");
    expect(res.status).toBe(401);
    expect((await entitlementOf(user.id))?.entitlement).toBe("free");
  });

  it("grants pro on initial purchase and records the expiry", async () => {
    const app = createApp();
    const { user } = await signup(app);
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    const res = await webhook(app, {
      type: "INITIAL_PURCHASE",
      app_user_id: user.id,
      entitlement_ids: ["pro"],
      expiration_at_ms: expiry,
    });
    expect(res.status).toBe(200);

    const row = await entitlementOf(user.id);
    expect(row?.entitlement).toBe("pro");
    expect(row?.expiresAt?.getTime()).toBe(expiry);
  });

  it("does NOT revoke on cancellation — access runs to the paid-for date", async () => {
    const app = createApp();
    const { user } = await signup(app);
    await webhook(app, {
      type: "INITIAL_PURCHASE",
      app_user_id: user.id,
      expiration_at_ms: Date.now() + 86_400_000,
    });

    // CANCELLATION means auto-renew off, not access ended.
    const res = await webhook(app, { type: "CANCELLATION", app_user_id: user.id });
    expect(res.status).toBe(200);
    expect((await entitlementOf(user.id))?.entitlement).toBe("pro");

    // EXPIRATION is what actually ends it.
    await webhook(app, { type: "EXPIRATION", app_user_id: user.id });
    expect((await entitlementOf(user.id))?.entitlement).toBe("free");
  });

  it("grants lifetime with no expiry on a one-off purchase", async () => {
    const app = createApp();
    const { user } = await signup(app);
    await webhook(app, { type: "NON_RENEWING_PURCHASE", app_user_id: user.id });
    const row = await entitlementOf(user.id);
    expect(row?.entitlement).toBe("lifetime");
    expect(row?.expiresAt).toBeNull();
  });

  it("revokes on refund", async () => {
    const app = createApp();
    const { user } = await signup(app);
    await webhook(app, { type: "INITIAL_PURCHASE", app_user_id: user.id });
    await webhook(app, { type: "REFUND", app_user_id: user.id });
    expect((await entitlementOf(user.id))?.entitlement).toBe("free");
  });

  it("acknowledges events for deleted users so RevenueCat stops retrying", async () => {
    const app = createApp();
    const res = await webhook(app, {
      type: "RENEWAL",
      app_user_id: "1e9f0f3c-0000-4000-8000-000000000000",
    });
    expect(res.status).toBe(200);
    expect((await res.json()) as { ignored: string }).toMatchObject({ ignored: "unknown_user" });
  });
});

describe("pro quota", () => {
  it("lifts the daily cap to the monthly fair-use limit", async () => {
    const app = createApp({
      identify: async () => ({
        name: "Thing",
        brand: null,
        model: null,
        category: "other",
        era: null,
        search_query: "thing",
        confidence: 0.9,
      }),
      priceSearch: async () => null,
    });
    const session = await signup(app);

    // Free tier stops at 3.
    for (let i = 0; i < 3; i++) {
      await app.request("/v1/scan", {
        method: "POST",
        headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: Buffer.from(`free${i}`.repeat(30)).toString("base64") }),
      });
    }
    const blocked = await app.request("/v1/scan", {
      method: "POST",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ imageBase64: Buffer.from("blocked".repeat(30)).toString("base64") }),
    });
    expect(blocked.status).toBe(429);

    // Upgrade via the webhook (the only path that grants Pro).
    await webhook(app, { type: "INITIAL_PURCHASE", app_user_id: session.user.id });

    const afterUpgrade = await app.request("/v1/scan", {
      method: "POST",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ imageBase64: Buffer.from("pro-scan".repeat(30)).toString("base64") }),
    });
    expect(afterUpgrade.status).toBe(201);
    const body = (await afterUpgrade.json()) as { quota: { limit: number; period: string } };
    expect(body.quota).toMatchObject({ limit: 1000, period: "month" });
  });

  it("treats an expired pro subscription as free", async () => {
    const app = createApp();
    const { accessToken, user } = await signup(app);
    await db
      .update(schema.users)
      .set({ entitlement: "pro", entitlementExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.users.id, user.id));

    const me = await app.request("/v1/me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = (await me.json()) as { quota: { limit: number; period: string } };
    expect(body.quota).toMatchObject({ limit: 3, period: "day" });
  });
});

describe("dev entitlement route", () => {
  it("is available outside production for Expo Go testing", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);
    const res = await app.request("/v1/dev/entitlement", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ entitlement: "pro" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("routing hygiene", () => {
  /**
   * Regression guard: account routes mount at the /v1 root. If their auth is
   * ever re-attached with use("*"), it fires for every sub-router too — two
   * user lookups per request, and an unknown /v1 path answers 401 instead of
   * 404, which hides typos behind a misleading error.
   */
  it("answers 404 (not 401) for an unknown authenticated /v1 path", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);
    const res = await app.request("/v1/definitely-not-a-route", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
  });
});
