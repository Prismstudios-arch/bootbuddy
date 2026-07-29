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
  blocked_from_sale?: boolean;
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
 *
 * Two paths, best first:
 *
 *  1. Price suggestions — derived from completed sales, so genuinely "sold
 *     for". Discogs only serves these to accounts with seller settings
 *     filled in; without that it returns "You must fill out your seller
 *     settings first" and we fall through.
 *  2. Marketplace stats across the top few matching pressings — the
 *     cheapest copy currently listed for each. That's asking-price data and
 *     is labelled as such, but it still answers the question that matters
 *     in a field: is this common and cheap, or scarce and worth having?
 */
export async function searchDiscogsPrices(query: string): Promise<PriceResult | null> {
  if (!env.DISCOGS_TOKEN) return null;

  const search = await discogsFetch<SearchResponse>(
    `/database/search?type=release&per_page=5&q=${encodeURIComponent(query)}`,
  );
  const releaseIds = (search?.results ?? [])
    .map((result) => result.id)
    .filter((id): id is number => typeof id === "number")
    .slice(0, 3);
  if (releaseIds.length === 0) return null;

  const primary = releaseIds[0]!;

  // Path 1: real sold-price data, if this account can see it.
  const suggestions = await discogsFetch<PriceSuggestions>(
    `/marketplace/price_suggestions/${primary}`,
  );
  const suggested: Pence[] = [];
  for (const entry of Object.values(suggestions ?? {})) {
    // Only GBP: converting currencies ourselves would invent precision we
    // don't have, and a wrong price is worse than no price.
    if (!entry || typeof entry !== "object") continue;
    if (entry.currency && entry.currency !== "GBP") continue;
    const amount = toPence(entry.value);
    if (amount !== null) suggested.push(amount);
  }

  if (suggested.length > 1) {
    const sorted = [...suggested].sort((a, b) => a - b);
    const median = medianPence(sorted);
    if (median !== null) {
      const stats = await discogsFetch<MarketplaceStats>(
        `/marketplace/stats/${primary}?curr_abbr=GBP`,
      );
      return {
        lowPence: sorted[0] ?? median,
        medianPence: median,
        highPence: sorted[sorted.length - 1] ?? median,
        listingCount: stats?.num_for_sale ?? suggested.length,
        maxBuyPence: suggestedMaxBuy(median),
        source: "discogs",
        basis: "sold",
      };
    }
  }

  // Path 2: cheapest listed copy of each matching pressing. A first press
  // and a 2011 reissue are different objects at very different money, so
  // the spread across pressings is genuinely informative rather than noise.
  const stats = await Promise.all(
    releaseIds.map((id) =>
      discogsFetch<MarketplaceStats>(`/marketplace/stats/${id}?curr_abbr=GBP`),
    ),
  );

  const lows: Pence[] = [];
  let forSale = 0;
  for (const stat of stats) {
    if (!stat || stat.blocked_from_sale) continue;
    forSale += stat.num_for_sale ?? 0;
    if ((stat.lowest_price?.currency ?? "GBP") !== "GBP") continue;
    const amount = toPence(stat.lowest_price?.value ?? undefined);
    if (amount !== null) lows.push(amount);
  }

  if (lows.length === 0) return null;

  const sorted = [...lows].sort((a, b) => a - b);
  const median = medianPence(sorted);
  if (median === null) return null;

  return {
    lowPence: sorted[0] ?? median,
    medianPence: median,
    highPence: sorted[sorted.length - 1] ?? median,
    listingCount: forSale,
    maxBuyPence: suggestedMaxBuy(median),
    source: "discogs",
    basis: "asking",
  };
}
