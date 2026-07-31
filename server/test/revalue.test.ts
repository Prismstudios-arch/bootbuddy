import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { createPgliteDb, schema, setDbForTests, type Db } from "../src/db/client.js";
import { resetRateLimits } from "../src/middleware/rate-limit.js";

/**
 * Re-pricing a portfolio was cheap when Discogs was the only source: one fast
 * call, and only records had a price at all. Grounded web pricing changed the
 * economics — every item can now be priced, and each one is a live web search
 * costing the best part of ten seconds.
 *
 * Twenty-five of those in one request is four minutes of held-open HTTP and
 * twenty-five searches billed, every time somebody idly pulls to refresh.
 * These tests pin the two brakes that stop that, because it is the kind of
 * cost that regresses silently and only shows up on a bill.
 */
let db: Db;

const lookupPrices = vi.hoisted(() => vi.fn());
vi.mock("../src/services/pricing.js", () => ({ lookupPrices }));

beforeAll(async () => {
  db = await createPgliteDb();
  setDbForTests(db);
});

beforeEach(() => {
  resetRateLimits();
  lookupPrices.mockReset();
  lookupPrices.mockResolvedValue({
    lowPence: 1000,
    medianPence: 2000,
    highPence: 3000,
    listingCount: 8,
    maxBuyPence: 800,
    source: "web",
    basis: "asking",
  });
});

async function signup(app: ReturnType<typeof createApp>) {
  const res = await app.request("/v1/auth/anonymous", { method: "POST" });
  return (await res.json()) as { accessToken: string; user: { id: string } };
}

async function addFind(app: ReturnType<typeof createApp>, token: string, name: string) {
  const res = await app.request("/v1/finds", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name, boughtPricePence: 100 }),
  });
  const { find } = (await res.json()) as { find: { id: string } };
  return find.id;
}

async function revalue(app: ReturnType<typeof createApp>, token: string) {
  const res = await app.request("/v1/finds/revalue", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  return (await res.json()) as { updated: number; skipped: number; checked: number };
}

describe("POST /v1/finds/revalue", () => {
  it("prices in-stock finds and records which way the value moved", async () => {
    const app = createApp();
    const session = await signup(app);
    const id = await addFind(app, session.accessToken, "Denby stoneware set");

    const body = await revalue(app, session.accessToken);
    expect(body.updated).toBe(1);

    const [row] = await db.select().from(schema.finds).where(eq(schema.finds.id, id));
    expect(row?.estimatedValuePence).toBe(2000);
    expect(row?.valuedAt).not.toBeNull();
  });

  it("does not re-price anything looked at in the last few hours", async () => {
    const app = createApp();
    const session = await signup(app);
    const id = await addFind(app, session.accessToken, "Technics platter");

    await revalue(app, session.accessToken);
    expect(lookupPrices).toHaveBeenCalledTimes(1);

    // Second pull-to-refresh straight after the first. Nothing at a boot sale
    // moves in that time, and each lookup is a billed web search.
    const second = await revalue(app, session.accessToken);
    expect(lookupPrices).toHaveBeenCalledTimes(1);
    expect(second.updated).toBe(0);
    expect(second.skipped).toBe(1);

    // Age it past the window and it becomes fair game again.
    await db
      .update(schema.finds)
      .set({ valuedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .where(eq(schema.finds.id, id));

    const third = await revalue(app, session.accessToken);
    expect(lookupPrices).toHaveBeenCalledTimes(2);
    expect(third.updated).toBe(1);
  });

  it("stops at its time budget rather than holding the request open", async () => {
    const app = createApp();
    const session = await signup(app);
    for (const name of ["one", "two", "three", "four", "five"]) {
      await addFind(app, session.accessToken, name);
    }

    // Every lookup burns most of the budget, so the pass should give up long
    // before it reaches the fifth item.
    lookupPrices.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 9_000));
      return null;
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const body = await revalue(app, session.accessToken);
      expect(body.checked).toBe(5);
      expect(lookupPrices.mock.calls.length).toBeLessThan(5);
      expect(body.skipped).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves sold finds alone", async () => {
    const app = createApp();
    const session = await signup(app);
    const id = await addFind(app, session.accessToken, "Game Boy, boxed");
    await app.request(`/v1/finds/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "sold", soldPricePence: 12000 }),
    });

    const body = await revalue(app, session.accessToken);
    expect(body.checked).toBe(0);
    expect(lookupPrices).not.toHaveBeenCalled();
  });
});
