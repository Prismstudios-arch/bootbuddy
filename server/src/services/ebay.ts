import { env } from "../env.js";
import { logger } from "../logger.js";
import { medianPence, pence, suggestedMaxBuy, type Pence } from "../lib/money.js";
import { UpstreamNotConfiguredError } from "./vision.js";

/**
 * eBay Browse API — ACTIVE UK listings only. These are asking prices, not
 * sold prices (findCompletedItems is dead, Marketplace Insights is gated),
 * and every surface that shows them must say so. The API contract encodes
 * the honesty: the field is `askingPrices`, never `soldPrices`.
 */
export type AskingPrices = {
  lowPence: Pence;
  medianPence: Pence;
  highPence: Pence;
  listingCount: number;
  maxBuyPence: Pence;
};

export type PriceSearchFn = (query: string) => Promise<AskingPrices | null>;

type EbayItemSummary = {
  title?: string;
  price?: { value?: string; currency?: string };
  buyingOptions?: string[];
};

const BASE = {
  production: "https://api.ebay.com",
  sandbox: "https://api.sandbox.ebay.com",
} as const;

// Listings that poison a median: spares/repairs pull it down misleadingly,
// and the buyer can't compare their intact find against a broken one anyway.
const JUNK_TITLE = /\b(spares?|repairs?|for parts|faulty|broken|not working|untested|read description)\b/i;
const MIN_PRICE_PENCE = 50;

let cachedToken: { value: string; expiresAt: number } | undefined;

async function getToken(forceRefresh = false): Promise<string> {
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
    throw new UpstreamNotConfiguredError("EBAY_CLIENT_ID/SECRET");
  }
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const res = await fetch(`${BASE[env.EBAY_ENV]}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(
        `${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });
  if (!res.ok) {
    throw new Error(`ebay token request failed: ${res.status}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return cachedToken.value;
}

async function browseSearch(query: string, token: string): Promise<Response> {
  const url = new URL(`${BASE[env.EBAY_ENV]}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "25");
  url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE|AUCTION}");
  return fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
    },
  });
}

/**
 * Returns price stats, or null when eBay is down/erroring — the caller
 * still returns the identification so the user gets *something*, with a
 * "market data unavailable, tap to retry" affordance. One 401 retry with a
 * fresh token, then give up gracefully. Never throws for eBay-side faults.
 */
export const searchAskingPrices: PriceSearchFn = async (query) => {
  if (env.DEV_FAKE_UPSTREAMS === "1" && env.NODE_ENV === "development") {
    return computeStats(FAKE_LISTINGS);
  }
  try {
    let res = await browseSearch(query, await getToken());
    if (res.status === 401) {
      res = await browseSearch(query, await getToken(true));
    }
    if (!res.ok) {
      logger.warn({ status: res.status, query }, "ebay browse failed");
      return null;
    }
    const body = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
    return computeStats(body.itemSummaries ?? []);
  } catch (err) {
    if (err instanceof UpstreamNotConfiguredError) throw err;
    logger.warn({ err, query }, "ebay unreachable");
    return null;
  }
};

/** Pure and exported so the junk filter + maths are unit-tested directly. */
export function computeStats(items: EbayItemSummary[]): AskingPrices | null {
  const prices: Pence[] = [];
  for (const item of items) {
    if (item.price?.currency !== "GBP" || item.price.value === undefined) continue;
    const p = Math.round(Number.parseFloat(item.price.value) * 100);
    if (!Number.isFinite(p) || p < MIN_PRICE_PENCE) continue;
    if (item.title && JUNK_TITLE.test(item.title)) continue;
    prices.push(pence(p));
  }
  const median = medianPence(prices);
  if (median === null) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    lowPence: sorted[0] ?? median,
    medianPence: median,
    highPence: sorted[sorted.length - 1] ?? median,
    listingCount: prices.length,
    maxBuyPence: suggestedMaxBuy(median),
  };
}

const FAKE_LISTINGS: EbayItemSummary[] = [
  { title: "Sony Walkman WM-EX194 personal cassette player", price: { value: "24.99", currency: "GBP" } },
  { title: "Sony Walkman WM-EX194 tested working", price: { value: "32.00", currency: "GBP" } },
  { title: "Sony WM-EX194 walkman blue", price: { value: "28.50", currency: "GBP" } },
  { title: "Sony Walkman WM-EX194 spares or repairs", price: { value: "8.99", currency: "GBP" } },
  { title: "Walkman WM-EX194 boxed", price: { value: "45.00", currency: "GBP" } },
];
