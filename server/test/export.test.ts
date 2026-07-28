import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { createPgliteDb, schema, setDbForTests, type Db } from "../src/db/client.js";
import { isoToDate, penceToDecimal, toCsv } from "../src/lib/csv.js";
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
  return (await res.json()) as { accessToken: string; user: { id: string } };
}

async function makePro(userId: string) {
  await db
    .update(schema.users)
    .set({ entitlement: "lifetime", entitlementExpiresAt: null })
    .where(eq(schema.users.id, userId));
}

describe("csv building", () => {
  it("neutralises spreadsheet formula injection", () => {
    // An item name comes from an AI model reading a photo, and notes are
    // free text — neither should be able to execute on open in Excel.
    const csv = toCsv(["Item"], [["=cmd|' /c calc'!A1"], ["+1+1"], ["@SUM(A1)"], ["-2"]]);
    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-2");
  });

  it("quotes fields containing commas, quotes and newlines", () => {
    const csv = toCsv(["Item", "Notes"], [['Sony "Walkman"', "line one\nline two"]]);
    expect(csv).toContain('"Sony ""Walkman"""');
    expect(csv).toContain('"line one\nline two"');
  });

  it("writes money as decimal pounds, not pence", () => {
    expect(penceToDecimal(1250)).toBe("12.50");
    expect(penceToDecimal(50)).toBe("0.50");
    expect(penceToDecimal(null)).toBe("");
  });

  it("writes sortable ISO dates", () => {
    expect(isoToDate(new Date("2026-07-28T23:39:44.746Z"))).toBe("2026-07-28");
    expect(isoToDate(null)).toBe("");
  });
});

describe("GET /v1/finds/export", () => {
  it("refuses the free tier with an upgrade prompt", async () => {
    const app = createApp();
    const { accessToken } = await signup(app);
    const res = await app.request("/v1/finds/export", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("pro_required");
  });

  it("exports a Pro user's portfolio with real numbers", async () => {
    const app = createApp();
    const session = await signup(app);

    const created = await app.request("/v1/finds", {
      method: "POST",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Sony Walkman, boxed",
        boughtPricePence: 50,
        notes: "Car boot, Lisburn",
      }),
    });
    const { find } = (await created.json()) as { find: { id: string } };
    await app.request(`/v1/finds/${find.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        status: "sold",
        soldPricePence: 4200,
        feesPence: 546,
        postagePence: 349,
      }),
    });

    await makePro(session.user.id);

    const res = await app.request("/v1/finds/export", {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain(".csv");

    const csv = await res.text();
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toContain("Bought price (GBP)");
    // Comma in the name forces quoting; money is pounds; profit is computed.
    expect(row).toContain('"Sony Walkman, boxed"');
    expect(row).toContain("0.50");
    expect(row).toContain("42.00");
    expect(row).toContain("32.55");
    expect(row).toContain("Car boot");
  });

  it("returns just the header row for an empty portfolio", async () => {
    const app = createApp();
    const session = await signup(app);
    await makePro(session.user.id);

    const res = await app.request("/v1/finds/export", {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    const csv = await res.text();
    expect(csv.trim().split("\r\n")).toHaveLength(1);
  });
});
