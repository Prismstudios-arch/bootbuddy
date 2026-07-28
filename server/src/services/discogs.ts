import { env } from "../env.js";
import { logger } from "../logger.js";
import { medianPence, pence, suggestedMaxBuy, type Pence } from "../lib/money.js";
import type { PriceResult } from "./pricing.js";

/**
 * Discogs pricing for records, CDs and tapes — a car boot staple, and the
 * one category where we can do better than eBay.
 *
 * eBay matches on fuzzy text, so "Rumours Fleetwood Mac" pulls in every
 * pressing, reissue and picture disc at once. Discogs matches a specific
 * release in a curated catalogue, and its price suggestions are derived
 * from actual completed sales rather than what someone is hoping for. That
 * means for vinyl we can honestly say "sold for", which we cannot with
 * eBay's active listings.
 *
 * The condition spread doubles as the price range: a boot-sale copy is
 * rarely Mint, so showing Good-to-Mint tells the buyer far more than a
 * single number would.
 */
const BASE = "https://api.discogs.com";
// Discogs rejects requests without a descriptive User-Agent.
const USER_AGENT = "BootSaleBuddy/1.0 (+https://boot-sale-buddy-api.fly.dev)";

type SearchResponse = {
  results?: { id?: number; title?: string; year?: string }[];
};

type PriceSuggestions = Record<string, { currency?: string; value?: number } | undefined>;

type MarketplaceStats = {
  num_for_sale?: number;
  lowest_price?: { value?: number; currency?: string } | null;
};

async function discogsFetch<T>(path: string): Promise<T | null> {
  if (!env.DISCOGS_TOKEN) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        authorization: `Discogs token=${env.DISCOGS_TOKEN}`,
        "user-agent": USER_AGENT,
      },
    });
    if (res.status === 429) {
      logger.warn({ path }, "discogs rate limited");
      return null;
    }
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "discogs request failed");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ err, path }, "discogs unreachable");
    return null;
  }
}

function toPence(value: number | undefined): Pence | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return pence(Math.round(value * 100));
}

/**
 * Returns null (never throws) so a Discogs outage just falls through to the
 * next provider rather than failing the scan.
 */
export async function searchDiscogsPrices(query: string): Promise<PriceResult | null> {
  if (!env.DISCOGS_TOKEN) return null;

  const search = await discogsFetch<SearchResponse>(
    `/database/search?type=release&per_page=5&q=${encodeURIComponent(query)}`,
  );
  const releaseId = search?.results?.find((result) => typeof result.id === "number")?.id;
  if (!releaseId) return null;

  // Suggestions are per-condition and sales-derived; stats give the live
  // listing count. Fetch together — one is useless without context.
  const [suggestions, stats] = await Promise.all([
    discogsFetch<PriceSuggestions>(`/marketplace/price_suggestions/${releaseId}`),
    discogsFetch<MarketplaceStats>(`/marketplace/stats/${releaseId}?curr_abbr=GBP`),
  ]);

  const values: Pence[] = [];
  for (const entry of Object.values(suggestions ?? {})) {
    // Only GBP: converting currencies ourselves would invent precision we
    // don't have, and a wrong price is worse than no price.
    if (entry?.currency && entry.currency !== "GBP") continue;
    const amount = toPence(entry?.value);
    if (amount !== null) values.push(amount);
  }

  if (values.length > 0) {
    const sorted = [...values].sort((a, b) => a - b);
    const median = medianPence(sorted);
    if (median !== null) {
      return {
        lowPence: sorted[0] ?? median,
        medianPence: median,
        highPence: sorted[sorted.length - 1] ?? median,
        // Each value is a condition grade, not a separate listing.
        listingCount: stats?.num_for_sale ?? values.length,
        maxBuyPence: suggestedMaxBuy(median),
        source: "discogs",
        basis: "sold",
      };
    }
  }

  // No sales history — fall back to the cheapest copy currently listed.
  const lowest = toPence(stats?.lowest_price?.value ?? undefined);
  if (lowest !== null && (stats?.lowest_price?.currency ?? "GBP") === "GBP") {
    return {
      lowPence: lowest,
      medianPence: lowest,
      highPence: lowest,
      listingCount: stats?.num_for_sale ?? 1,
      maxBuyPence: suggestedMaxBuy(lowest),
      source: "discogs",
      basis: "asking",
    };
  }

  return null;
}
