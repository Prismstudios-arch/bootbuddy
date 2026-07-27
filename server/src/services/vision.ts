import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env.js";
import { logger } from "../logger.js";

/**
 * Item identification. Claude identifies; eBay prices — the model is never
 * asked for a value and the schema gives it nowhere to put one.
 *
 * Cost note (why the free tier is sustainable): the app uploads ≤1024px
 * ~70%-quality JPEGs, ≈1.1k image tokens + ~300 output tokens on
 * claude-haiku-4-5 ($1/$5 per MTok) ≈ £0.002/scan. Three free scans/day
 * ≈ £0.03/user/month worst case. ANTHROPIC_MODEL stays configurable so the
 * fixtures suite can confirm the cheapest model that passes before ship.
 */
export const identificationSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe("Concise item name incl. brand + model when visible, e.g. 'Sony Walkman WM-EX194'. Null if no single sellable item is identifiable."),
  brand: z.string().nullable().describe("Brand/maker if identifiable, else null"),
  model: z.string().nullable().describe("Model number/name if visible, else null"),
  category: z
    .string()
    .describe("One of: electronics, audio, gaming, tools, china_glass, records_media, toys_games, clothing, books, homeware, collectables, other"),
  era: z.string().nullable().describe("Rough era if relevant, e.g. '1980s', else null"),
  search_query: z
    .string()
    .describe("What a UK reseller would type into eBay to find this exact item: brand + model + key attribute. No condition words, no punctuation, max 8 words. Empty string if nothing identifiable."),
  confidence: z
    .number()
    .describe("Honest 0-1 confidence that name identifies the specific item. Below 0.4 means guessing."),
});

export type Identification = z.infer<typeof identificationSchema>;

const SYSTEM_PROMPT = `You identify second-hand items photographed at UK car boot sales for resale valuation.

Rules:
- Identify the single most prominent sellable item in the photo.
- Be specific: brand and model matter enormously to resale value. Read any visible labels, logos or model numbers carefully.
- NEVER estimate prices or values — identification only.
- The search_query must be what an experienced UK eBay seller would type to find this exact item. Specific beats generic: "technics sl-1200 turntable" not "record player".
- If there is no identifiable sellable item (blurry, empty table, a person), return name null, empty search_query, confidence 0.
- Confidence is honest: 0.9+ only when the exact model is readable, ~0.5 when you recognise the type but not the model, below 0.4 when guessing.`;

export type IdentifyFn = (imageBase64: string) => Promise<Identification>;

let client: Anthropic | undefined;

export const identifyItem: IdentifyFn = async (imageBase64) => {
  if (env.DEV_FAKE_UPSTREAMS === "1" && env.NODE_ENV === "development") {
    return FAKE_IDENTIFICATION;
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new UpstreamNotConfiguredError("ANTHROPIC_API_KEY");
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // One retry on schema-parse failure, per spec; structured outputs make
  // failures rare, but a refusal or max_tokens cut can still produce null.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.parse({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
            },
            { type: "text", text: "Identify this item." },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(identificationSchema) },
    });

    if (response.parsed_output) {
      const id = response.parsed_output;
      // Clamp rather than trust: numeric ranges aren't schema-enforceable.
      return { ...id, confidence: Math.min(1, Math.max(0, id.confidence)) };
    }
    logger.warn({ attempt, stop: response.stop_reason }, "vision parse failed");
  }
  throw new Error("vision identification failed twice");
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
