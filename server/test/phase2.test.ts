import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createPgliteDb, setDbForTests, type Db } from "../src/db/client.js";
import { resetRateLimits } from "../src/middleware/rate-limit.js";
import { computeStats } from "../src/services/ebay.js";
import { VisionBusyError } from "../src/services/vision-gemini.js";
import { pence } from "../src/lib/money.js";
import type { Identification } from "../src/services/vision.js";

// JWT_SECRET comes from vitest env config (see vitest.config.ts).

const WALKMAN: Identification = {
  name: "Sony Walkman WM-EX194",
  brand: "Sony",
  model: "WM-EX194",
  category: "audio",
  era: "1990s",
  search_query: "sony walkman wm-ex194",
  confidence: 0.86,
};

const PRICES = {
  lowPence: pence(899),
  medianPence: pence(2850),
  highPence: pence(4500),
  listingCount: 21,
  maxBuyPence: pence(1140),
  source: "ebay" as const,
  basis: "asking" as const,
};

function fakeImage(seed = "a"): string {
  return Buffer.from(`fake-jpeg-bytes-${seed}`.repeat(20)).toString("base64");
}

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
  expect(res.status).toBe(201);
  return (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; entitlement: string };
  };
}

function authed(token: string, body?: unknown) {
  return {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

describe("auth", () => {
  it("creates an anonymous account and bootstraps /v1/me", async () => {
    const app = createApp();
    const session = await signup(app);
    expect(session.user.entitlement).toBe("free");

    const me = await app.request("/v1/me", {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { quota: { used: number; limit: number; period: string } };
    expect(body.quota).toMatchObject({ used: 0, limit: 3, period: "day" });
  });

  it("rotates refresh tokens and burns the family on replay", async () => {
    const app = createApp();
    const session = await signup(app);

    const r1 = await app.request("/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    expect(r1.status).toBe(200);
    const rotated = (await r1.json()) as { refreshToken: string };
    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    // Replaying the original (now rotated) token = theft signal.
    const replay = await app.request("/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    expect(replay.status).toBe(401);

    // The whole family is dead — even the "legitimate" newest token.
    const afterBurn = await app.request("/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: rotated.refreshToken }),
    });
    expect(afterBurn.status).toBe(401);
  });

  it("rejects garbage bearer tokens", async () => {
    const app = createApp();
    const res = await app.request("/v1/me", { headers: { authorization: "Bearer nope" } });
    expect(res.status).toBe(401);
  });
});

describe("scan", () => {
  it("identifies, prices, persists and reports quota", async () => {
    const app = createApp({ identify: async () => WALKMAN, priceSearch: async () => PRICES });
    const session = await signup(app);

    const res = await app.request(
      "/v1/scan",
      authed(session.accessToken, { imageBase64: fakeImage() }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      scan: { name: string; askingPrices: { medianPence: number; maxBuyPence: number } };
      quota: { used: number; limit: number };
    };
    expect(body.scan.name).toBe("Sony Walkman WM-EX194");
    expect(body.scan.askingPrices.medianPence).toBe(2850);
    expect(body.scan.askingPrices.maxBuyPence).toBe(1140);
    expect(body.quota).toMatchObject({ used: 1, limit: 3 });
  });

  it("serves duplicate photos from cache without burning quota", async () => {
    const app = createApp({ identify: async () => WALKMAN, priceSearch: async () => PRICES });
    const session = await signup(app);

    await app.request("/v1/scan", authed(session.accessToken, { imageBase64: fakeImage("dup") }));
    const again = await app.request(
      "/v1/scan",
      authed(session.accessToken, { imageBase64: fakeImage("dup") }),
    );
    expect(again.status).toBe(200);
    const body = (await again.json()) as { deduped: boolean; quota: { used: number } };
    expect(body.deduped).toBe(true);
    expect(body.quota.used).toBe(1);
  });

  it("enforces the free quota with friendly copy on the 4th scan", async () => {
    let calls = 0;
    const app = createApp({
      identify: async () => {
        calls++;
        return WALKMAN;
      },
      priceSearch: async () => PRICES,
    });
    const session = await signup(app);

    for (let i = 0; i < 3; i++) {
      const res = await app.request(
        "/v1/scan",
        authed(session.accessToken, { imageBase64: fakeImage(`q${i}`) }),
      );
      expect(res.status).toBe(201);
    }
    const fourth = await app.request(
      "/v1/scan",
      authed(session.accessToken, { imageBase64: fakeImage("q3") }),
    );
    expect(fourth.status).toBe(429);
    const body = (await fourth.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("quota_exceeded");
    expect(body.error.message).toContain("3 free scans");
    expect(calls).toBe(3); // the vision model was never called for the blocked scan
  });

  it("returns the identification with null prices when eBay is down", async () => {
    const app = createApp({ identify: async () => WALKMAN, priceSearch: async () => null });
    const session = await signup(app);
    const res = await app.request(
      "/v1/scan",
      authed(session.accessToken, { imageBase64: fakeImage("down") }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scan: { name: string; askingPrices: null } };
    expect(body.scan.name).toBe("Sony Walkman WM-EX194");
    expect(body.scan.askingPrices).toBeNull();
  });

  it("skips the eBay lookup entirely for unidentifiable photos", async () => {
    let priceCalls = 0;
    const app = createApp({
      identify: async () => ({
        name: null,
        brand: null,
        model: null,
        category: "other",
        era: null,
        search_query: "",
        confidence: 0,
      }),
      priceSearch: async () => {
        priceCalls++;
        return PRICES;
      },
    });
    const session = await signup(app);
    const res = await app.request(
      "/v1/scan",
      authed(session.accessToken, { imageBase64: fakeImage("blur") }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scan: { name: null; askingPrices: null } };
    expect(body.scan.name).toBeNull();
    expect(priceCalls).toBe(0);
  });

  it("refine re-prices without a vision call and marks confidence 1", async () => {
    let identifyCalls = 0;
    const app = createApp({
      identify: async () => {
        identifyCalls++;
        return { ...WALKMAN, confidence: 0.3 };
      },
      priceSearch: async () => PRICES,
    });
    const session = await signup(app);
    const created = await app.request(
      "/v1/scan",
      authed(session.accessToken, { imageBase64: fakeImage("refine") }),
    );
    const { scan } = (await created.json()) as { scan: { id: string } };

    const refined = await app.request(
      `/v1/scan/${scan.id}/refine`,
      authed(session.accessToken, { query: "sony walkman wm-ex194 blue" }),
    );
    expect(refined.status).toBe(200);
    const body = (await refined.json()) as {
      scan: { confidence: number; searchQuery: string; askingPrices: { medianPence: number } };
    };
    expect(body.scan.confidence).toBe(1);
    expect(body.scan.searchQuery).toBe("sony walkman wm-ex194 blue");
    expect(identifyCalls).toBe(1);
  });

  it("refunds the quota unit when the vision provider fails", async () => {
    const app = createApp({
      identify: async () => {
        throw new VisionBusyError();
      },
      priceSearch: async () => PRICES,
    });
    const session = await signup(app);

    const res = await app.request(
      "/v1/scan",
      authed(session.accessToken, { imageBase64: fakeImage("busy") }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("vision_busy");

    // A failed scan must not cost the user one of their three.
    const me = await app.request("/v1/me", {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    const { quota } = (await me.json()) as { quota: { used: number } };
    expect(quota.used).toBe(0);
  });

  it("lists recent scans newest-first for the camera strip", async () => {
    const app = createApp({ identify: async () => WALKMAN, priceSearch: async () => PRICES });
    const session = await signup(app);
    for (const seed of ["s1", "s2"]) {
      await app.request("/v1/scan", authed(session.accessToken, { imageBase64: fakeImage(seed) }));
    }

    const res = await app.request("/v1/scan", {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scans: { id: string; createdAt: string }[] };
    expect(body.scans).toHaveLength(2);
    expect(new Date(body.scans[0]!.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body.scans[1]!.createdAt).getTime(),
    );
  });

  it("rejects junk bodies", async () => {
    const app = createApp({ identify: async () => WALKMAN, priceSearch: async () => PRICES });
    const session = await signup(app);
    const res = await app.request("/v1/scan", authed(session.accessToken, { image: "nope" }));
    expect(res.status).toBe(400);
  });
});

describe("account deletion", () => {
  it("hard-deletes the user and cascades their data", async () => {
    const app = createApp({ identify: async () => WALKMAN, priceSearch: async () => PRICES });
    const session = await signup(app);
    await app.request("/v1/scan", authed(session.accessToken, { imageBase64: fakeImage("del") }));

    const del = await app.request("/v1/account", {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(del.status).toBe(200);

    // The still-valid JWT is now useless — the row is gone.
    const me = await app.request("/v1/me", {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(me.status).toBe(401);
  });
});

describe("eBay stats", () => {
  const gbp = (value: string, title = "ok item") => ({ title, price: { value, currency: "GBP" } });

  it("filters junk and computes low/median/high", () => {
    const stats = computeStats([
      gbp("24.99"),
      gbp("32.00"),
      gbp("28.50"),
      gbp("8.99", "spares or repairs walkman"), // junk title — out
      gbp("0.30"),                              // under 50p — out
      { title: "usd listing", price: { value: "20.00", currency: "USD" } }, // wrong currency
      gbp("45.00"),
    ]);
    expect(stats).not.toBeNull();
    expect(stats).toMatchObject({
      lowPence: 2499,
      medianPence: 3025, // even count: mean of 28.50 and 32.00
      highPence: 4500,
      listingCount: 4,
      maxBuyPence: 1210,
    });
  });

  it("returns null when nothing survives the filters", () => {
    expect(computeStats([gbp("2.00", "faulty broken for parts")])).toBeNull();
    expect(computeStats([])).toBeNull();
  });
});
