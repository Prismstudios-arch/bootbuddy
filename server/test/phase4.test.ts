import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createPgliteDb, setDbForTests, type Db } from "../src/db/client.js";
import { estimateFees, marginPercent, realisedProfit, unrealisedProfit } from "../src/lib/profit.js";
import { resetRateLimits } from "../src/middleware/rate-limit.js";

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
  return (await res.json()) as { accessToken: string };
}

function req(token: string, method: string, body?: unknown) {
  return {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

type FindResponse = {
  find: {
    id: string;
    status: string;
    realisedProfitPence: number | null;
    unrealisedProfitPence: number | null;
    soldAt: string | null;
    soldPricePence: number | null;
  };
};

describe("profit maths", () => {
  const base = {
    boughtPricePence: 50,
    estimatedValuePence: 4200,
    soldPricePence: null,
    feesPence: 0,
    postagePence: 0,
    status: "in_stock" as const,
  };

  it("computes the dream flip: 50p to £42", () => {
    const sold = {
      ...base,
      status: "sold" as const,
      soldPricePence: 4200,
      feesPence: 546, // 13%
      postagePence: 349,
    };
    // 4200 - 50 - 546 - 349
    expect(realisedProfit(sold)).toBe(3255);
    expect(marginPercent(sold)).toBeCloseTo(77.5, 1);
  });

  it("keeps realised and unrealised strictly separate", () => {
    expect(realisedProfit(base)).toBeNull(); // not sold yet
    expect(unrealisedProfit(base)).toBe(4150);

    const sold = { ...base, status: "sold" as const, soldPricePence: 1000 };
    expect(unrealisedProfit(sold)).toBeNull(); // no longer a guess
  });

  it("reports losses honestly", () => {
    const flop = {
      ...base,
      boughtPricePence: 2000,
      status: "sold" as const,
      soldPricePence: 1500,
      feesPence: 195,
      postagePence: 349,
    };
    expect(realisedProfit(flop)).toBe(-1044);
  });

  it("estimates eBay fees at 13% and never divides by zero", () => {
    expect(estimateFees(4200)).toBe(546);
    expect(estimateFees(4200, 10)).toBe(420);
    expect(marginPercent({ ...base, status: "sold", soldPricePence: 0 })).toBeNull();
  });
});

describe("finds", () => {
  it("logs a buy, then marks it sold and computes profit", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);

    const created = await app.request(
      "/v1/finds",
      req(accessToken, "POST", {
        name: "Sony Walkman WM-EX194",
        boughtPricePence: 50,
        estimatedValuePence: 2850,
      }),
    );
    expect(created.status).toBe(201);
    const { find } = (await created.json()) as FindResponse;
    expect(find.status).toBe("in_stock");
    expect(find.unrealisedProfitPence).toBe(2800);
    expect(find.realisedProfitPence).toBeNull();

    const sold = await app.request(
      `/v1/finds/${find.id}`,
      req(accessToken, "PATCH", {
        status: "sold",
        soldPricePence: 4200,
        feesPence: 546,
        postagePence: 349,
      }),
    );
    expect(sold.status).toBe(200);
    const body = (await sold.json()) as FindResponse;
    expect(body.find.realisedProfitPence).toBe(3255);
    expect(body.find.unrealisedProfitPence).toBeNull();
    // Selling without a date means "just now" — one less tap in the field.
    expect(body.find.soldAt).not.toBeNull();
  });

  it("clears the sale when a find is put back in stock", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);
    const created = await app.request(
      "/v1/finds",
      req(accessToken, "POST", { name: "Returned item", boughtPricePence: 100 }),
    );
    const { find } = (await created.json()) as FindResponse;
    await app.request(
      `/v1/finds/${find.id}`,
      req(accessToken, "PATCH", { status: "sold", soldPricePence: 900 }),
    );

    const unsold = await app.request(
      `/v1/finds/${find.id}`,
      req(accessToken, "PATCH", { status: "in_stock" }),
    );
    const body = (await unsold.json()) as FindResponse;
    expect(body.find.soldPricePence).toBeNull();
    expect(body.find.soldAt).toBeNull();
    expect(body.find.realisedProfitPence).toBeNull();
  });

  it("filters by status and refuses other people's finds", async () => {
    const app = createApp();
    const mine = await signup(app);
    const theirs = await signup(app);

    const created = await app.request(
      "/v1/finds",
      req(mine.accessToken, "POST", { name: "Mine", boughtPricePence: 100 }),
    );
    const { find } = (await created.json()) as FindResponse;
    await app.request(
      "/v1/finds",
      req(mine.accessToken, "POST", { name: "Also mine", boughtPricePence: 200 }),
    );
    await app.request(
      `/v1/finds/${find.id}`,
      req(mine.accessToken, "PATCH", { status: "sold", soldPricePence: 900 }),
    );

    const inStock = await app.request("/v1/finds?status=in_stock", {
      headers: { authorization: `Bearer ${mine.accessToken}` },
    });
    const list = (await inStock.json()) as { finds: unknown[] };
    expect(list.finds).toHaveLength(1);

    // Another user must not be able to read or touch it.
    const intruder = await app.request(
      `/v1/finds/${find.id}`,
      req(theirs.accessToken, "PATCH", { name: "Stolen" }),
    );
    expect(intruder.status).toBe(404);
    const theirList = await app.request("/v1/finds", {
      headers: { authorization: `Bearer ${theirs.accessToken}` },
    });
    expect(((await theirList.json()) as { finds: unknown[] }).finds).toHaveLength(0);
  });

  it("rejects a negative buy price", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);
    const res = await app.request(
      "/v1/finds",
      req(accessToken, "POST", { name: "Impossible", boughtPricePence: -100 }),
    );
    expect(res.status).toBe(400);
  });
});

describe("stats", () => {
  it("aggregates realised, unrealised, best flip and a 6-month series", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);

    // A great flip, a modest one, and something still on the shelf.
    for (const [name, bought, sold] of [
      ["Game Boy", 200, 4500],
      ["Pyrex bowl", 100, 800],
    ] as const) {
      const created = await app.request(
        "/v1/finds",
        req(accessToken, "POST", { name, boughtPricePence: bought }),
      );
      const { find } = (await created.json()) as FindResponse;
      await app.request(
        `/v1/finds/${find.id}`,
        req(accessToken, "PATCH", { status: "sold", soldPricePence: sold, feesPence: 0 }),
      );
    }
    await app.request(
      "/v1/finds",
      req(accessToken, "POST", {
        name: "Still in the loft",
        boughtPricePence: 300,
        estimatedValuePence: 2500,
      }),
    );

    const res = await app.request("/v1/stats", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const { stats } = (await res.json()) as {
      stats: {
        realisedProfitPence: number;
        unrealisedProfitPence: number;
        thisMonthPence: number;
        soldCount: number;
        inStockCount: number;
        bestFlip: { name: string; profitPence: number } | null;
        monthly: { month: string; profitPence: number }[];
        averageMarginPercent: number | null;
      };
    };

    expect(stats.realisedProfitPence).toBe(4300 + 700);
    expect(stats.unrealisedProfitPence).toBe(2200);
    expect(stats.thisMonthPence).toBe(5000);
    expect(stats.soldCount).toBe(2);
    expect(stats.inStockCount).toBe(1);
    expect(stats.bestFlip?.name).toBe("Game Boy");
    expect(stats.bestFlip?.profitPence).toBe(4300);
    expect(stats.averageMarginPercent).toBeCloseTo(91.5, 0);
    // Stable chart shape from day one.
    expect(stats.monthly).toHaveLength(6);
  });

  it("returns a clean zeroed shape for a brand-new user", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);
    const res = await app.request("/v1/stats", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const { stats } = (await res.json()) as {
      stats: { realisedProfitPence: number; bestFlip: null; monthly: unknown[] };
    };
    expect(stats.realisedProfitPence).toBe(0);
    expect(stats.bestFlip).toBeNull();
    expect(stats.monthly).toHaveLength(6);
  });
});
