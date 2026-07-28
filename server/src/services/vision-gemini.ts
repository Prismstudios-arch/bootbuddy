import { env } from "../env.js";
import { logger } from "../logger.js";
import {
  SYSTEM_PROMPT,
  toIdentification,
  UpstreamNotConfiguredError,
  type Identification,
} from "./vision.js";

/**
 * Gemini vision via the REST API (no SDK dependency — one endpoint, one
 * shape). Structured output is enforced with responseSchema, thinking is
 * disabled (thinkingBudget 0) for latency, and the JSON is still
 * zod-validated because a schema header is a request, not a guarantee.
 */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", nullable: true },
    brand: { type: "STRING", nullable: true },
    model: { type: "STRING", nullable: true },
    category: { type: "STRING" },
    era: { type: "STRING", nullable: true },
    search_query: { type: "STRING" },
    confidence: { type: "NUMBER" },
  },
  required: ["name", "brand", "model", "category", "era", "search_query", "confidence"],
} as const;

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
};

export async function identifyWithGemini(imageBase64: string): Promise<Identification> {
  if (!env.GEMINI_API_KEY) {
    throw new UpstreamNotConfiguredError("GEMINI_API_KEY");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        parts: [
          { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
          { text: "Identify this item." },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 400,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // One retry covers both transient 5xx/429 and a malformed-JSON candidate.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body,
    });

    if (res.status === 429) {
      // Free-tier rate limit — surface as a retryable condition, not a 500.
      logger.warn({ attempt }, "gemini rate limited");
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw new VisionBusyError();
    }
    if (!res.ok) {
      logger.warn({ status: res.status, attempt }, "gemini request failed");
      continue;
    }

    const json = (await res.json()) as GeminiResponse;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      try {
        const identification = toIdentification(JSON.parse(text));
        if (identification) return identification;
      } catch {
        // fall through to retry
      }
    }
    logger.warn({ attempt, finish: json.candidates?.[0]?.finishReason }, "gemini parse failed");
  }
  throw new Error("gemini identification failed twice");
}

/** Free-tier RPM exhausted — the route turns this into a friendly 503. */
export class VisionBusyError extends Error {
  constructor() {
    super("vision provider is rate limited");
  }
}
