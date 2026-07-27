import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * App factory, separate from the listener so tests can call
 * app.request(...) without binding a port.
 *
 * Route modules land in Phase 2:
 *   /v1/auth      — anonymous + Sign in with Apple
 *   /v1/scan      — vision identify + eBay pricing (quota-gated)
 *   /v1/finds     — portfolio CRUD
 *   /v1/stats     — profit aggregates
 *   /v1/webhooks  — RevenueCat
 */
export function createApp() {
  const app = new Hono();

  app.use("*", requestId());
  app.use("*", secureHeaders());

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
