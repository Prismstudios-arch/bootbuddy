import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Lazy singleton so importing app.ts (e.g. in tests or before secrets exist)
 * never opens a connection. Routes that need the DB call db() and get a
 * clear error if DATABASE_URL is unset.
 */
let instance: ReturnType<typeof create> | undefined;

function create(url: string) {
  const client = postgres(url, {
    max: 10,
    // Fly internal networking; TLS handled at the edge. Neon requires ssl.
    ...(url.includes("neon.tech") ? { ssl: "require" as const } : {}),
  });
  return drizzle(client, { schema });
}

export function db() {
  if (!instance) {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured");
    }
    instance = create(env.DATABASE_URL);
  }
  return instance;
}

export { schema };
