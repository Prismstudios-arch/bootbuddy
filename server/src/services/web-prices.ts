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
 * What makes it defensible is that the model must actually go and look.
 * With the google_search tool the response reports the searches it ran in
 * `groundingMetadata.webSearchQueries`, and an answer that ran no searches
 * is one it made up from memory — so it gets thrown away.
 *
 * (The first cut of this checked `groundingChunks` instead, which is the
 * stronger signal — per-sentence citations. It rejected every single answer
 * in production. Chunks are only populated when there is prose to attach
 * citations to, and this prompt deliberately asks for two bare lines, so the
 * format defeated the guard. webSearchQueries is what's actually available
 * here: proof a live search happened, not proof of each figure's provenance.
 * Worth knowing that's the weaker of the two.)
 *
 * On top of that:
 *
 *  - The reply must parse as an exact format. Prose gets binned rather than
 *    regex-mined for anything that looks like a price.
 *  - The figures must be internally coherent and in a sane range.
 *  - It must have seen at least three separate prices.
 *  - NONE is explicitly offered as a good answer, so "I couldn't find out"
 *    has somewhere to go that isn't a guess.
 *
 * The model reports whether its figures are completed sales or live
 * listings, and that flows straight through to the label on screen. In
 * practice it answers LISTED nearly every time — eBay's sold pages are
 * barely indexed — which is a decent sign it isn't bluffing.
 */
const PROMPT = `You price second-hand items for UK car-boot resellers.

Search for what this actually goes for SECOND-HAND in the UK right now:

  {QUERY}

Search more than once if you need to. Prefer COMPLETED/SOLD prices (eBay
sold listings, price guides, auction results). If you can only find live
listings, use those instead. Look at eBay UK, Vinted, Gumtree, Facebook
Marketplace, CeX, Music Magpie and specialist dealers. Ignore brand-new
retail prices unless the item is only ever sold new, and ignore job lots and
spares-or-repair listings.

Reply with exactly two lines and nothing else:

PRICES <low>|<median>|<high>|<count>|<SOLD or LISTED>
SOURCES <the sites you actually used, comma separated>

  - GBP, plain numbers, two decimals, no currency symbols, no commas.
  - <low> and <high> are the cheapest and dearest genuine examples.
  - <median> is the typical price and must sit between them.
  - <count> is how many separate prices you actually saw.
  - SOLD only if those are completed sales. Otherwise LISTED.

If you found fewer than three genuine second-hand prices, reply with exactly:

NONE

Do not guess and do not price from memory. NONE is a good answer.`;

const LINE =
  /PRICES\s+(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+)\s*\|\s*(SOLD|LISTED)/i;

/** £0.50 to £50,000. Outside that we've misread something, not found a bargain. */
const MIN_PENCE = 50;
const MAX_PENCE = 5_000_000;
const MIN_LISTINGS = 3;

type GroundedResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      /** The searches the model actually ran. Empty means it didn't look. */
      webSearchQueries?: string[];
      /** Per-sentence citations. Only populated when the answer is prose. */
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
        generationConfig: { temperature: 0, maxOutputTokens: 2048 },
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

  // The safety argument rests on this: an answer produced without running a
  // single search is a guess wearing a number's clothes, and nothing
  // downstream can tell it apart from a good one.
  const searches = candidate?.groundingMetadata?.webSearchQueries ?? [];
  if (searches.length === 0) {
    logger.info({ query }, "web price answer ran no searches — discarded");
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

  // Only the model's explicit SOLD claim earns the "sold" label. Anything
  // else — including a missing or unexpected token — reads as asking, which
  // is the answer that can't overstate what an item fetches.
  const basis = match[5]!.toUpperCase() === "SOLD" ? "sold" : "asking";

  logger.info({ query, median, listingCount, basis, searches: searches.length }, "priced from web");

  return {
    lowPence: low,
    medianPence: median,
    highPence: high,
    listingCount,
    maxBuyPence: suggestedMaxBuy(median),
    source: "web",
    basis,
  };
}
