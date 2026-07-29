import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb, schema } from "../db/client.js";
import { isoToDate, penceToDecimal, toCsv } from "../lib/csv.js";
import { realisedProfit, unrealisedProfit } from "../lib/profit.js";
import { lookupPrices } from "../services/pricing.js";

/**
 * Portfolio CRUD. A "find" is something you actually bought — created by
 * the two-tap buy log on the Result Sheet, or by hand (manual logging stays
 * free forever; only scanning is metered).
 */
const moneyPence = z.number().int().min(0).max(100_000_00);

/**
 * Cap on one revalue pass. Each item costs upstream API calls, and Discogs
 * rate limits at 60 requests a minute — a 200-item portfolio would blow
 * straight through it and get everything throttled.
 */
const MAX_REVALUE = 25;

const createBody = z.object({
  name: z.string().trim().min(1).max(120),
  boughtPricePence: moneyPence,
  scanId: z.string().uuid().optional(),
  estimatedValuePence: moneyPence.optional(),
  localPhotoKey: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  boughtAt: z.string().datetime().optional(),
});

const updateBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  boughtPricePence: moneyPence.optional(),
  estimatedValuePence: moneyPence.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  // Marking as sold: send status plus the sale details.
  status: z.enum(["in_stock", "sold"]).optional(),
  soldPricePence: moneyPence.nullable().optional(),
  feesPence: moneyPence.optional(),
  postagePence: moneyPence.optional(),
  soldAt: z.string().datetime().nullable().optional(),
});

export const findsRoutes = new Hono<AuthEnv>()
  .use("*", requireAuth)

  .get("/", async (c) => {
    const status = c.req.query("status");
    const user = c.get("user");
    const db = await getDb();

    const where =
      status === "in_stock" || status === "sold"
        ? and(eq(schema.finds.userId, user.id), eq(schema.finds.status, status))
        : eq(schema.finds.userId, user.id);

    const rows = await db
      .select()
      .from(schema.finds)
      .where(where)
      .orderBy(desc(schema.finds.createdAt));
    return c.json({ finds: rows.map(toFindResponse) });
  })

  /**
   * CSV export — a Pro feature, so the entitlement is checked here rather
   * than trusted from the client. Sellers use this for their tax return, so
   * it includes every field that matters to one and none that don't.
   */
  .get("/export", async (c) => {
    const user = c.get("user");
    const isPro =
      user.entitlement === "lifetime" ||
      (user.entitlement === "pro" &&
        (user.entitlementExpiresAt === null || user.entitlementExpiresAt.getTime() > Date.now()));

    if (!isPro) {
      return c.json(
        {
          error: {
            code: "pro_required",
            message: "CSV export is a Buddy Pro feature.",
          },
        },
        403,
      );
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.finds)
      .where(eq(schema.finds.userId, user.id))
      .orderBy(desc(schema.finds.boughtAt));

    const csv = toCsv(
      [
        "Item",
        "Status",
        "Bought date",
        "Bought price (GBP)",
        "Estimated value (GBP)",
        "Sold date",
        "Sold price (GBP)",
        "Selling fees (GBP)",
        "Postage (GBP)",
        "Profit (GBP)",
        "Notes",
      ],
      rows.map((find) => [
        find.name,
        find.status === "sold" ? "Sold" : "In stock",
        isoToDate(find.boughtAt),
        penceToDecimal(find.boughtPricePence),
        penceToDecimal(find.estimatedValuePence),
        isoToDate(find.soldAt),
        penceToDecimal(find.soldPricePence),
        find.status === "sold" ? penceToDecimal(find.feesPence) : "",
        find.status === "sold" ? penceToDecimal(find.postagePence) : "",
        penceToDecimal(realisedProfit(find)),
        find.notes,
      ]),
    );

    const filename = `boot-sale-buddy-${new Date().toISOString().slice(0, 10)}.csv`;
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(csv);
  })

  /**
   * Re-price everything still in stock.
   *
   * A find's estimated value is captured when it's logged and then never
   * moves, so a portfolio slowly drifts away from reality — which matters,
   * because unrealised profit is the number people look at to decide what
   * to list next. This refreshes those estimates from the live price
   * sources.
   *
   * Only items we have a live source for actually change: today that means
   * records and CDs via Discogs. Everything else keeps the value it had and
   * is reported as skipped, rather than being silently zeroed or left
   * looking freshly checked when it wasn't.
   */
  .post("/revalue", async (c) => {
    const user = c.get("user");
    const db = await getDb();

    const rows = await db
      .select({
        id: schema.finds.id,
        name: schema.finds.name,
        estimatedValuePence: schema.finds.estimatedValuePence,
        query: schema.scans.searchQuery,
        category: schema.scans.category,
      })
      .from(schema.finds)
      .leftJoin(schema.scans, eq(schema.finds.scanId, schema.scans.id))
      .where(and(eq(schema.finds.userId, user.id), eq(schema.finds.status, "in_stock")))
      .limit(MAX_REVALUE);

    let updated = 0;
    let skipped = 0;
    const now = new Date();

    for (const row of rows) {
      // Fall back to the item name for finds logged by hand, which have no
      // scan behind them.
      const query = row.query ?? row.name;
      const prices = query ? await lookupPrices(query, row.category ?? undefined) : null;
      if (!prices) {
        skipped += 1;
        continue;
      }
      await db
        .update(schema.finds)
        .set({
          estimatedValuePence: prices.medianPence,
          valuedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.finds.id, row.id));
      updated += 1;
    }

    return c.json({ updated, skipped, checked: rows.length });
  })

  .post("/", async (c) => {
    const parsed = createBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "bad_request", message: "Send at least { name, boughtPricePence }." } },
        400,
      );
    }
    const user = c.get("user");
    const db = await getDb();
    const { boughtAt, ...rest } = parsed.data;

    const [find] = await db
      .insert(schema.finds)
      .values({
        userId: user.id,
        ...rest,
        ...(boughtAt ? { boughtAt: new Date(boughtAt) } : {}),
        ...(rest.estimatedValuePence !== undefined ? { valuedAt: new Date() } : {}),
      })
      .returning();
    if (!find) throw new Error("find insert returned nothing");
    return c.json({ find: toFindResponse(find) }, 201);
  })

  .patch("/:id", async (c) => {
    const parsed = updateBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "bad_request", message: "Nothing valid to update." } }, 400);
    }
    const user = c.get("user");
    const db = await getDb();
    const id = c.req.param("id");

    const [existing] = await db
      .select()
      .from(schema.finds)
      .where(and(eq(schema.finds.id, id), eq(schema.finds.userId, user.id)))
      .limit(1);
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Can't find that one." } }, 404);
    }

    // Assign only the keys actually present: under exactOptionalPropertyTypes
    // a spread of `{ name?: string | undefined }` isn't a valid partial update.
    const { soldAt, ...rest } = parsed.data;
    const patch: Partial<typeof schema.finds.$inferInsert> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) {
        Object.assign(patch, { [key]: value });
      }
    }

    if (soldAt !== undefined) patch.soldAt = soldAt ? new Date(soldAt) : null;
    // Selling without an explicit date means "just now" — one less tap.
    if (parsed.data.status === "sold" && soldAt === undefined && existing.soldAt === null) {
      patch.soldAt = new Date();
    }
    // Un-selling clears the sale so stats don't count a ghost.
    if (parsed.data.status === "in_stock") {
      patch.soldPricePence = null;
      patch.soldAt = null;
      patch.feesPence = 0;
      patch.postagePence = 0;
    }

    const [updated] = await db
      .update(schema.finds)
      .set(patch)
      .where(eq(schema.finds.id, existing.id))
      .returning();
    if (!updated) throw new Error("find update returned nothing");
    return c.json({ find: toFindResponse(updated) });
  })

  .delete("/:id", async (c) => {
    const user = c.get("user");
    const db = await getDb();
    const deleted = await db
      .delete(schema.finds)
      .where(and(eq(schema.finds.id, c.req.param("id")), eq(schema.finds.userId, user.id)))
      .returning({ id: schema.finds.id });
    if (deleted.length === 0) {
      return c.json({ error: { code: "not_found", message: "Can't find that one." } }, 404);
    }
    return c.json({ ok: true });
  });

type FindRow = typeof schema.finds.$inferSelect;

/** Profit is computed server-side so every client agrees on the numbers. */
export function toFindResponse(find: FindRow) {
  return {
    id: find.id,
    name: find.name,
    scanId: find.scanId,
    localPhotoKey: find.localPhotoKey,
    status: find.status,
    boughtPricePence: find.boughtPricePence,
    boughtAt: find.boughtAt.toISOString(),
    estimatedValuePence: find.estimatedValuePence,
    valuedAt: find.valuedAt?.toISOString() ?? null,
    soldPricePence: find.soldPricePence,
    feesPence: find.feesPence,
    postagePence: find.postagePence,
    soldAt: find.soldAt?.toISOString() ?? null,
    notes: find.notes,
    realisedProfitPence: realisedProfit(find),
    unrealisedProfitPence: unrealisedProfit(find),
    createdAt: find.createdAt.toISOString(),
  };
}
