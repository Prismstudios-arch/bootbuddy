import { z } from "zod";

/**
 * All configuration enters through this file. Secrets are set via
 * `fly secrets set` in production and `.env` locally (loaded by tsx/node
 * --env-file). Nothing else in the codebase reads process.env directly.
 *
 * In development the third-party keys are optional so the server can boot
 * and serve /healthz before you have credentials; any route that needs a
 * missing key fails with a clear 503 instead of a crash. In production
 * every secret is required and the process refuses to start without them.
 */
const base = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),

  DATABASE_URL: z.string().url().optional(),

  // Auth — HS256 signing secret for access/refresh JWTs. 32+ bytes.
  JWT_SECRET: z.string().min(32).optional(),

  // Vision identification. gemini = Google AI Studio free tier (default);
  // anthropic = claude-haiku-4-5. Same schema either way; swap via env.
  VISION_PROVIDER: z.enum(["gemini", "anthropic"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),

  // eBay Browse API — client-credentials OAuth, EBAY_GB marketplace.
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_ENV: z.enum(["production", "sandbox"]).default("production"),

  // Sign in with Apple token verification (audience check).
  APPLE_BUNDLE_ID: z.string().default("com.bootsalebuddy.app"),

  // Dev-only: serve canned vision/eBay responses so the full scan flow can
  // be exercised locally with zero third-party keys. Ignored in production.
  DEV_FAKE_UPSTREAMS: z.string().optional(),

  // RevenueCat webhook Authorization header value (configured in RC dashboard).
  REVENUECAT_WEBHOOK_AUTH: z.string().optional(),

  SENTRY_DSN: z.string().url().optional(),
});

/**
 * Hard requirements only — the app is useless without a DB, auth, or its
 * vision provider. eBay and RevenueCat degrade gracefully when unset
 * (prices come back null / webhook route isn't live yet), so missing keys
 * there must not block a deploy.
 */
const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "JWT_SECRET"] as const;

export type Env = z.infer<typeof base>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = base.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    const missing: string[] = REQUIRED_IN_PRODUCTION.filter((key) => env[key] === undefined);
    if (env.VISION_PROVIDER === "gemini" && !env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
    if (env.VISION_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      missing.push("ANTHROPIC_API_KEY");
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing required production secrets: ${missing.join(", ")}\n` +
          `Set them with: fly secrets set ${missing.map((k) => `${k}=...`).join(" ")}`,
      );
    }
  }
  return env;
}

export const env = loadEnv();
