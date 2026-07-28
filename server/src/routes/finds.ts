import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb, schema } from "../db/client.js";
import { realisedProfit, unrealisedProfit } from "../lib/profit.js";

/**
 * Portfolio CRUD. A "find" is something you actually bought — created by
 * the two-tap buy log on the Result Sheet, or by hand (manual logging stays
 * free forever; only scanning is metered).
 */
const moneyPence = z.number().int().min(0).max(100_000_00);

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
