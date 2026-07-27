import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { scanRoutes } from "./routes/scan.js";
import type { PriceSearchFn } from "./services/ebay.js";
import type { IdentifyFn } from "./services/vision.js";

export type AppDeps = { identify?: IdentifyFn; priceSearch?: PriceSearchFn };

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
  app.route("/v1", accountRoutes);

  // Privacy policy + terms are served from the API host so the App Store
  // listing has stable URLs from day one. Real copy lands in ship prep.
  app.get("/privacy", (c) =>
    c.html(placeholderPage("Privacy Policy", "Our privacy policy is being finalised.")),
  );
  app.get("/terms", (c) =>
    c.html(
      placeholderPage(
        "Terms of Use",
        "Our terms are being finalised. Price information shown in Boot Sale Buddy is an estimate based on current eBay asking prices and is not financial advice.",
      ),
    ),
  );

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "That route doesn't exist." } }, 404),
  );

  app.onError((err, c) => {
    logger.error({ err, requestId: c.get("requestId") }, "unhandled error");
    return c.json(
      { error: { code: "internal", message: "Something went wrong on our end. Try again?" } },
      500,
    );
  });

  return app;
}

function placeholderPage(title: string, body: string): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Boot Sale Buddy</title><style>body{font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1.5rem;background:#121110;color:#F5F2ED;line-height:1.6}h1{font-size:1.5rem}</style></head><body><h1>${title}</h1><p>${body}</p></body></html>`;
}
