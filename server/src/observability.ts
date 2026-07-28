import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Crash reporting. Entirely optional: with no SENTRY_DSN configured every
 * function here is a no-op, so local development and tests never phone
 * home and the server boots fine without the secret.
 *
 * PII scrubbing is deliberate rather than default. Scans carry photos and
 * identifications, users have Apple sub identifiers, and requests carry
 * bearer tokens — none of that belongs in an error tracker.
 */
let enabled = false;

export function initObservability(): void {
  if (!env.SENTRY_DSN) {
    logger.info("sentry not configured — error reporting disabled");
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Don't let the SDK hoover up request bodies or headers by default.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Belt and braces: strip anything that could carry a secret or an
      // image payload even if a future call site attaches it by accident.
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      delete event.request?.data;
      if (event.extra) {
        for (const key of ["imageBase64", "image", "token", "accessToken", "refreshToken"]) {
          delete event.extra[key];
        }
      }
      return event;
    },
  });
  enabled = true;
  logger.info({ environment: env.NODE_ENV }, "sentry initialised");
}

/** Report an unexpected failure. Safe to call when Sentry is disabled. */
export function captureError(error: unknown, context?: Record<string, string>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { tags: context } : undefined);
}
