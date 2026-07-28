import { z } from "zod";
import { env } from "../env.js";
import { identifyWithAnthropic } from "./vision-anthropic.js";
import { identifyWithGemini } from "./vision-gemini.js";

/**
 * Item identification — provider-pluggable. The model identifies; eBay
 * prices — no provider is ever asked for a value and the schema gives it
 * nowhere to put one.
 *
 * VISION_PROVIDER=gemini (default): Google AI Studio free tier — £0/scan,
 * rate-limited upstream, and Google may use free-tier inputs to improve
 * their models (fine for boot-sale photos; revisit before any "private
 * collection" feature). VISION_PROVIDER=anthropic: claude-haiku-4-5,
 * ≈£0.002/scan, no training on API data. Both return the same shape and
 * are validated by the same schema, so swapping is an env change.
 */
export const identificationSchema = z.object({
  name: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  category: z.string(),
  era: z.string().nullable(),
  search_query: z.string(),
  confidence: z.number(),
});

export type Identification = z.infer<typeof identificationSchema>;

export const SYSTEM_PROMPT = `You identify second-hand items photographed at UK car boot sales for resale valuation.

Rules:
- Identify the single most prominent sellable item in the photo.
- Be specific: brand and model matter enormously to resale value. Read any visible labels, logos or model numbers carefully.
- NEVER estimate prices or values — identification only.
- The search_query must be what an experienced UK eBay seller would type to find this exact item. Specific beats generic: "technics sl-1200 turntable" not "record player".
- If there is no identifiable sellable item (blurry, empty table, a person), return name null, empty search_query, confidence 0.
- Confidence is honest: 0.9+ only when the exact model is readable, ~0.5 when you recognise the type but not the model, below 0.4 when guessing.`;

/** Validate + clamp any provider's raw JSON into an Identification. */
export function toIdentification(raw: unknown): Identification | null {
  const parsed = identificationSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    confidence: Math.min(1, Math.max(0, parsed.data.confidence)),
  };
}

export type IdentifyFn = (imageBase64: string) => Promise<Identification>;

export const identifyItem: IdentifyFn = async (imageBase64) => {
  if (env.DEV_FAKE_UPSTREAMS === "1" && env.NODE_ENV === "development") {
    return FAKE_IDENTIFICATION;
  }
  return env.VISION_PROVIDER === "anthropic"
    ? identifyWithAnthropic(imageBase64)
    : identifyWithGemini(imageBase64);
};

export class UpstreamNotConfiguredError extends Error {
  constructor(public readonly what: string) {
    super(`${what} is not configured`);
  }
}

const FAKE_IDENTIFICATION: Identification = {
  name: "Sony Walkman WM-EX194",
  brand: "Sony",
  model: "WM-EX194",
  category: "audio",
  era: "1990s",
  search_query: "sony walkman wm-ex194",
  confidence: 0.86,
};
