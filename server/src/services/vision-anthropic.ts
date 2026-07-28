import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "../env.js";
import { logger } from "../logger.js";
import {
  identificationSchema,
  SYSTEM_PROMPT,
  toIdentification,
  UpstreamNotConfiguredError,
  type Identification,
} from "./vision.js";

/**
 * Anthropic vision path (VISION_PROVIDER=anthropic). claude-haiku-4-5 at
 * $1/$5 per MTok ≈ £0.002 per compressed scan; API data isn't used for
 * training, which matters if scan privacy ever becomes a selling point.
 */
let client: Anthropic | undefined;

export async function identifyWithAnthropic(imageBase64: string): Promise<Identification> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new UpstreamNotConfiguredError("ANTHROPIC_API_KEY");
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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

    const identification = toIdentification(response.parsed_output);
    if (identification) return identification;
    logger.warn({ attempt, stop: response.stop_reason }, "anthropic vision parse failed");
  }
  throw new Error("anthropic identification failed twice");
}
