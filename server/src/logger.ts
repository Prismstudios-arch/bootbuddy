import { pino } from "pino";
import { env } from "./env.js";

/**
 * Structured JSON logs in production (Fly collects stdout), pretty in dev.
 * Never log tokens, auth headers, or image payloads — redaction is enforced
 * here rather than relying on call-site discipline.
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "*.authorization",
      "*.token",
      "*.access_token",
      "*.refresh_token",
      "*.image",
      "*.imageBase64",
    ],
    censor: "[redacted]",
  },
  ...(env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
