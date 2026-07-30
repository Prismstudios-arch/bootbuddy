import { env } from "../env.js";
import { logger } from "../logger.js";
import { pence, suggestedMaxBuy, type Pence } from "../lib/money.js";
import type { PriceResult } from "./pricing.js";

/**
 * Prices from a Gemini search over the live web.
 *
 * The obvious objection first, because it is the right one: an LLM asked
 * "what's this worth" will cheerfully make a number up, and a made-up price
 * is worse than no price when someone is about to spend their own money.
 * That is exactly why the app has never done this.
 *
 * What makes it defensible here is grounding. With the google_search tool
 * the model runs real searches and the response carries `groundingMetadata`
 * listing the pages it actually read. So:
 *
 *  - No grounding chunks in the response? We throw the answer away. A price
 *    with nothing behind it is the failure mode we're guarding against, and
 *    it is indistinguishable from a good one by looking at the number.
 *  - The reply must parse as an exact one-line format. Prose gets binned
 *    rather than regex-mined for anything that looks like a price.
 *  - The figures must be internally coherent and in a sane range, or they
 *    go the same way.
 *
 * Even then this is ASKING prices — what things are listed at across UK
 * marketplaces — never sold prices, and it is labelled as such all the way
 * to the screen. Discogs stays ahead of it in the router because completed
 * sales beat listings every time.
 *
 * Grounding is not free: it roughly doubles the upstream calls per scan and
 * adds a couple of seconds. Missing key or GEMINI_WEB_PRICES unset, and the
 * provider is simply skipped.
 */
const PROMPT = `You price second-hand items for UK car-boot resellers.

Search for what this actually sells for SECOND-HAND in the UK right now:

  {QUERY}

Look at real listings — eBay UK, Vinted, Gumtree, Facebook Marketplace, CeX,
Music Magpie, specialist dealers. Ignore brand-new retail prices unless the
item is only ever sold new. Ignore obvious outliers, job lots and broken or
spares-or-repair listings.

Reply with ONE line and nothing else, in exactly this format:

PRICES <low>|<median>|<high>|<count>

  - GBP, plain numbers, two decimals, no currency symbols and no commas.
  - <low> and <high> are the cheapest and dearest genuine examples you saw.
  - <median> is the typical price and must sit between them.
  - <count> is how many separate listings you actually looked at.

If you found fewer than three genuine second-hand listings, reply with
exactly:

NONE

Do not guess and do not estimate from memory. NONE is a good answer.`;

const LINE = /PRICES\s+(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+)/i;

/** £0.50 to £50,000. Outside that we've misread something, not found a bargain. */
const MIN_PENCE = 50;
const MAX_PENCE = 5_000_000;
const MIN_LISTINGS = 3;

type GroundedResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
};

function toPence(value: string): Pence | null {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount * 100);
  if (rounded < MIN_PENCE || rounded > MAX_PENCE) return null;
  return pence(rounded);
}

/**
 * Returns null (never throws) so a Gemini outage or a wishy-washy answer
 * just leaves the scan without a price, exactly as it is today.
 */
export async function searchWebPrices(query: string): Promise<PriceResult | null> {
  if (!env.GEMINI_API_KEY || !env.GEMINI_WEB_PRICES) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT.replace("{QUERY}", query) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0, maxOutputTokens: 800 },
      }),
    });
  } catch (err) {
    logger.warn({ err, query }, "web price search unreachable");
    return null;
  }

  if (!res.ok) {
    logger.warn({ status: res.status, query }, "web price search failed");
    return null;
  }

  const json = (await res.json()) as GroundedResponse;
  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join(" ") ?? "";

  // The whole safety argument rests on this check. An answer the model
  // produced without reading anything is a guess wearing a number's
  // clothes, and we cannot tell the difference downstream.
  const sources = candidate?.groundingMetadata?.groundingChunks ?? [];
  if (sources.length === 0) {
    logger.info({ query }, "web price answer had no grounding — discarded");
    return null;
  }

  const match = LINE.exec(text);
  if (!match) {
    // Includes the honest NONE case, which is a success for the prompt even
    // though it's a null here.
    logger.info({ query, saidNone: /\bNONE\b/i.test(text) }, "no usable web price");
    return null;
  }

  const low = toPence(match[1]!);
  const median = toPence(match[2]!);
  const high = toPence(match[3]!);
  const listingCount = Number.parseInt(match[4]!, 10);

  if (low === null || median === null || high === null) return null;
  if (!(low <= median && median <= high)) {
    logger.warn({ query, low, median, high }, "web prices out of order — discarded");
    return null;
  }
  if (!Number.isFinite(listingCount) || listingCount < MIN_LISTINGS) return null;

  logger.info(
    { query, median, listingCount, sources: sources.length },
    "priced from web search",
  );

  return {
    lowPence: low,
    medianPence: median,
    highPence: high,
    listingCount,
    maxBuyPence: suggestedMaxBuy(median),
    source: "web",
    basis: "asking",
  };
}
