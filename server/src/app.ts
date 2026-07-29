import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.js";
import { privacyDoc, privacyPage, supportPage, termsDoc, termsPage } from "./legal.js";
import { logger } from "./logger.js";
import { captureError } from "./observability.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { devRoutes } from "./routes/dev.js";
import { findsRoutes } from "./routes/finds.js";
import { redeemRoutes } from "./routes/redeem.js";
import { scanRoutes } from "./routes/scan.js";
import { webhookRoutes } from "./routes/webhooks.js";
import type { PriceLookup } from "./services/pricing.js";
import type { IdentifyFn } from "./services/vision.js";

export type AppDeps = { identify?: IdentifyFn; priceSearch?: PriceLookup };

/**
 * App factory, separate from the listener so tests can call
 * app.request(...) without binding a port, and inject fake upstreams.
 *
 * Mounted:
 *   /v1/auth      — anonymous + refresh + Sign in with Apple
 *   /v1/scan      — vision identify + eBay pricing (quota-gated)
 *   /v1/me        — session bootstrap (user + quota)
 *   /v1/account   — hard deletion (App Review 5.1.1(v))
 * Phase 4/5:
 *   /v1/finds, /v1/stats, /v1/webhooks/revenuecat
 */
export function createApp(deps: AppDeps = {}) {
  const app = new Hono();

  app.use("*", requestId());
  app.use("*", secureHeaders());
  app.use("*", rateLimit({ name: "global", limit: 120, windowMs: 60_000 }));

  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Date.now() - start,
        requestId: c.get("requestId"),
      },
      "request",
    );
  });

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "boot-sale-buddy",
      env: env.NODE_ENV,
      uptime: Math.round(process.uptime()),
    }),
  );

  // Strictest limits on the expensive/abusable routes, per the checklist.
  app.route(
    "/v1/auth",
    new Hono().use("*", rateLimit({ name: "auth", limit: 10, windowMs: 60_000 })).route("/", authRoutes),
  );
  app.route(
    "/v1/scan",
    new Hono()
      .use("*", rateLimit({ name: "scan", limit: 15, windowMs: 60_000 }))
      .route("/", scanRoutes(deps)),
  );
  app.route("/v1/finds", findsRoutes);
  // Brute-force protection: a promo code is a secret, so guessing must be slow.
  app.route(
    "/v1/redeem",
    new Hono()
      .use("*", rateLimit({ name: "redeem", limit: 5, windowMs: 10 * 60_000 }))
      .route("/", redeemRoutes),
  );
  app.route("/v1/webhooks", webhookRoutes);
  app.route("/v1", accountRoutes);

  // Never exposed on the deployed API — see routes/dev.ts.
  if (env.NODE_ENV !== "production") {
    app.route("/v1/dev", devRoutes);
  }

  // Public URLs for the App Store listing and the in-app links. Content
  // lives in legal.ts and must stay true to what the code actually does.
  app.get("/privacy", (c) => c.html(privacyPage));
  app.get("/terms", (c) => c.html(termsPage));
  // App Store Connect requires a reachable Support URL.
  app.get("/support", (c) => c.html(supportPage));

  // Same content as the pages above, as data, so the app can render it
  // natively instead of throwing the user out to a browser. Unauthenticated
  // and cacheable — it's public information either way.
  app.get("/v1/legal", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({ privacy: privacyDoc, terms: termsDoc });
  });

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "That route doesn't exist." } }, 404),
  );

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    logger.error({ err, requestId }, "unhandled error");
    captureError(err, { path: c.req.path, method: c.req.method, requestId: String(requestId) });
    return c.json(
      { error: { code: "internal", message: "Something went wrong on our end. Try again?" } },
      500,
    );
  });

  return app;
}

