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

  // Anthropic — vision identification. Model is configurable so the fixture
  // suite (server/fixtures) can pick the cheapest model that passes.
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),

  // eBay Browse API — client-credentials OAuth, EBAY_GB marketplace.
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),

  // RevenueCat webhook Authorization header value (configured in RC dashboard).
  REVENUECAT_WEBHOOK_AUTH: z.string().optional(),

  SENTRY_DSN: z.string().url().optional(),
});

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "JWT_SECRET",
  "ANTHROPIC_API_KEY",
  "EBAY_CLIENT_ID",
  "EBAY_CLIENT_SECRET",
  "REVENUECAT_WEBHOOK_AUTH",
] as const;

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
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => env[key] === undefined);
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
