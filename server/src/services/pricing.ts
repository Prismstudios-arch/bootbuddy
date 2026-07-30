import { logger } from "../logger.js";
import type { Pence } from "../lib/money.js";
import { searchAskingPrices } from "./ebay.js";
import { searchDiscogsPrices } from "./discogs.js";
import { searchWebPrices } from "./web-prices.js";

/**
 * Which source priced an item, and whether those numbers are what things
 * actually SOLD for or what sellers are ASKING.
 *
 * This distinction is carried all the way to the screen rather than being
 * flattened here, because the app must never imply it knows sold prices
 * when it doesn't. eBay's public API only exposes active listings; Discogs
 * price suggestions come from completed sales. Same shape, very different
 * confidence, and the user deserves to know which they're looking at.
 */
export type PriceSource = "ebay" | "discogs" | "web";
export type PriceBasis = "asking" | "sold";

export type PriceResult = {
  lowPence: Pence;
  medianPence: Pence;
  highPence: Pence;
  listingCount: number;
  maxBuyPence: Pence;
  source: PriceSource;
  basis: PriceBasis;
};

export type PriceLookup = (query: string, category?: string) => Promise<PriceResult | null>;

/**
 * Categories the vision prompt can return that Discogs actually covers.
 * Sending a toaster to a music database wastes a request and returns
 * confident nonsense, so the routing is deliberately narrow.
 */
const MUSIC_CATEGORIES = new Set(["records_media", "music", "vinyl", "records"]);

function isMusic(category: string | undefined): boolean {
  if (!category) return false;
  const normalised = category.toLowerCase().replace(/[\s-]/g, "_");
  return MUSIC_CATEGORIES.has(normalised) || normalised.includes("record");
}

/**
 * Tries the best-suited source first and falls back. Every provider returns
 * null rather than throwing on failure, so one being down or unconfigured
 * degrades to the next instead of failing the scan.
 *
 * The order is a confidence order, not a convenience one. Discogs knows what
 * copies actually sold for; eBay knows what a catalogue of live listings
 * says; a grounded web search knows what a handful of pages said a moment
 * ago. Each is a step down in certainty, so each only runs when the one
 * above it came back with nothing.
 */
export const lookupPrices: PriceLookup = async (query, category) => {
  if (isMusic(category)) {
    const discogs = await searchDiscogsPrices(query);
    if (discogs) return discogs;
    logger.info({ query }, "discogs had nothing, falling back to ebay");
  }

  const ebay = await searchAskingPrices(query);
  if (ebay) return { ...ebay, source: "ebay", basis: "asking" };

  // Records are worth a second look even if the model didn't label them as
  // music — plenty of scans come back as "collectables" or "other".
  if (!isMusic(category)) {
    const discogs = await searchDiscogsPrices(query);
    if (discogs) return discogs;
  }

  // Last resort, and the only one that covers a toaster or a Denby dinner
  // set. Off unless GEMINI_WEB_PRICES is set.
  return await searchWebPrices(query);
};
