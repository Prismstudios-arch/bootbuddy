import { createHash } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb, schema } from "../db/client.js";
import { consumeScan, getQuota, refundScan } from "../services/quota.js";
import { lookupPrices, type PriceLookup } from "../services/pricing.js";
import { VisionBusyError } from "../services/vision-gemini.js";
import { identifyItem, UpstreamNotConfiguredError, type IdentifyFn } from "../services/vision.js";

/**
 * POST /v1/scan — the product. Quota → dedupe → Claude identifies →
 * eBay prices → persist → one response. Target p95 < 4s; the two upstream
 * calls run sequentially because eBay needs Claude's search query.
 *
 * POST /v1/scan/:id/refine — user corrected the item name; re-run ONLY the
 * eBay lookup (no vision spend) and update the row.
 */
const scanBody = z.object({
  // Client sends the already-compressed JPEG (≤1024px, ~70%) as raw base64.
  // ~1.5MB of image ≈ 2MB of base64.
  imageBase64: z
    .string()
    .min(100)
    .max(2_100_000)
    .regex(/^[A-Za-z0-9+/=]+$/, "not base64"),
});

const refineBody = z.object({ query: z.string().trim().min(2).max(80) });

const MIN_CONFIDENCE_FOR_LOOKUP = 0.15;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

type Deps = { identify: IdentifyFn; priceSearch: PriceLookup };

export function scanRoutes(overrides: Partial<Deps> = {}) {
  const deps: Deps = {
    identify: overrides.identify ?? identifyItem,
    priceSearch: overrides.priceSearch ?? lookupPrices,
  };
  return new Hono<AuthEnv>()
    .use("*", requireAuth)

    /** Recent scans — powers the strip along the bottom of the camera. */
    .get("/", async (c) => {
      const user = c.get("user");
      const db = await getDb();
      const rows = await db
        .select()
        .from(schema.scans)
        .where(eq(schema.scans.userId, user.id))
        .orderBy(desc(schema.scans.createdAt))
        .limit(20);
      return c.json({ scans: rows.map(toScanResponse) });
    })

    .post(
      "/",
      bodyLimit({
        maxSize: 3 * 1024 * 1024,
        onError: (c) =>
          c.json({ error: { code: "too_large", message: "That photo's too big — try again." } }, 413),
      }),
      async (c) => {
        const parsed = scanBody.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) {
          return c.json(
            { error: { code: "bad_request", message: "Send { imageBase64 } (JPEG, base64)." } },
            400,
          );
        }
        const user = c.get("user");
        const db = await getDb();
        const imageHash = createHash("sha256").update(parsed.data.imageBase64).digest("hex");

        // Same photo scanned again recently? Serve the stored result free —
        // no quota burn, no Anthropic spend, instant response.
        const [duplicate] = await db
          .select()
          .from(schema.scans)
          .where(
            and(
              eq(schema.scans.userId, user.id),
              eq(schema.scans.imageHash, imageHash),
              gte(schema.scans.createdAt, new Date(Date.now() - DEDUPE_WINDOW_MS)),
            ),
          )
          .orderBy(desc(schema.scans.createdAt))
          .limit(1);
        if (duplicate) {
          return c.json({ scan: toScanResponse(duplicate), quota: await getQuota(db, user), deduped: true });
        }

        const { allowed, quota } = await consumeScan(db, user);
        if (!allowed) {
          const message =
            quota.period === "day"
              ? "That's your 3 free scans for today. Back at midnight — or go Pro for unlimited."
              : "You've hit this month's fair-use cap. It resets on the 1st.";
          return c.json({ error: { code: "quota_exceeded", message }, quota }, 429);
        }

        let identification;
        try {
          identification = await deps.identify(parsed.data.imageBase64);
        } catch (err) {
          // The scan didn't happen — give the quota unit back before failing.
          await refundScan(db, user.id);
          if (err instanceof UpstreamNotConfiguredError) {
            return c.json(
              { error: { code: "not_configured", message: `Server missing ${err.what}.` } },
              503,
            );
          }
          if (err instanceof VisionBusyError) {
            return c.json(
              {
                error: {
                  code: "vision_busy",
                  message: "The scanner's swamped right now — give it a minute and try again.",
                },
              },
              503,
            );
          }
          throw err;
        }

        const identifiable =
          identification.confidence >= MIN_CONFIDENCE_FOR_LOOKUP &&
          identification.search_query.length > 0;
        // eBay failure degrades gracefully: prices null, app offers retry.
        const prices = identifiable
          ? await deps.priceSearch(identification.search_query, identification.category)
          : null;

        const [scan] = await db
          .insert(schema.scans)
          .values({
            userId: user.id,
            imageHash,
            itemName: identification.name,
            brand: identification.brand,
            category: identification.category,
            searchQuery: identification.search_query,
            confidence: identification.confidence,
            priceLowPence: prices?.lowPence ?? null,
            priceMedianPence: prices?.medianPence ?? null,
            priceHighPence: prices?.highPence ?? null,
            listingCount: prices?.listingCount ?? 0,
            priceSource: prices?.source ?? null,
            priceBasis: prices?.basis ?? null,
          })
          .returning();
        if (!scan) throw new Error("scan insert returned nothing");

        return c.json({ scan: toScanResponse(scan), quota }, 201);
      },
    )

    .post("/:id/refine", async (c) => {
      const parsed = refineBody.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return c.json({ error: { code: "bad_request", message: "Send { query }." } }, 400);
      }
      const user = c.get("user");
      const db = await getDb();
      const [scan] = await db
        .select()
        .from(schema.scans)
        .where(and(eq(schema.scans.id, c.req.param("id")), eq(schema.scans.userId, user.id)))
        .limit(1);
      if (!scan) {
        return c.json({ error: { code: "not_found", message: "Can't find that scan." } }, 404);
      }

      const prices = await deps.priceSearch(parsed.data.query);
      const [updated] = await db
        .update(schema.scans)
        .set({
          searchQuery: parsed.data.query,
          itemName: parsed.data.query,
          confidence: 1, // the human said so
          priceLowPence: prices?.lowPence ?? null,
          priceMedianPence: prices?.medianPence ?? null,
          priceHighPence: prices?.highPence ?? null,
          listingCount: prices?.listingCount ?? 0,
          priceSource: prices?.source ?? null,
          priceBasis: prices?.basis ?? null,
        })
        .where(eq(schema.scans.id, scan.id))
        .returning();
      if (!updated) throw new Error("scan update returned nothing");

      return c.json({ scan: toScanResponse(updated), quota: await getQuota(db, user) });
    });
}

type ScanRow = typeof schema.scans.$inferSelect;

/**
 * Wire shape the app consumes. `askingPrices` is deliberately named for
 * what it is; maxBuy = median × 0.4 (fees + margin — see lib/money.ts).
 */
function toScanResponse(scan: ScanRow) {
  const hasPrices = scan.priceMedianPence !== null;
  return {
    id: scan.id,
    name: scan.itemName,
    brand: scan.brand,
    category: scan.category,
    searchQuery: scan.searchQuery,
    confidence: scan.confidence,
    askingPrices: hasPrices
      ? {
          lowPence: scan.priceLowPence,
          medianPence: scan.priceMedianPence,
          highPence: scan.priceHighPence,
          listingCount: scan.listingCount,
          maxBuyPence: Math.floor((scan.priceMedianPence ?? 0) * 0.4),
          // Which source, and whether these are completed sales or live
          // asking prices. Defaults are the cautious ones: an older row
          // with no basis recorded must read as "asking", never "sold".
          source: scan.priceSource ?? "ebay",
          basis: scan.priceBasis === "sold" ? "sold" : "asking",
        }
      : null,
    createdAt: scan.createdAt.toISOString(),
  };
}
