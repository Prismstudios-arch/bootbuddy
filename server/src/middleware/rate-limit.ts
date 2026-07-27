import { createMiddleware } from "hono/factory";

/**
 * Fixed-window in-memory rate limiter. Per-machine (Fly runs 2), so real
 * limits are ~2× the numbers here — fine for abuse braking, which is the
 * job; billing safety comes from the DB-backed quota, not from this.
 * Swap for a shared store only if machine count grows.
 */
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

// Prune dead windows so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of buckets) {
    if (win.resetAt < now) buckets.delete(key);
  }
}, 60_000).unref();

export function rateLimit(opts: { name: string; limit: number; windowMs: number }) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("fly-client-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "local";
    const key = `${opts.name}:${ip}`;
    const now = Date.now();
    let win = buckets.get(key);
    if (!win || win.resetAt < now) {
      win = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, win);
    }
    win.count += 1;
    if (win.count > opts.limit) {
      c.header("Retry-After", String(Math.ceil((win.resetAt - now) / 1000)));
      return c.json(
        { error: { code: "rate_limited", message: "Easy! Give it a few seconds and try again." } },
        429,
      );
    }
    await next();
  });
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear();
}
