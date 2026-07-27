import type { PgDatabase } from "drizzle-orm/pg-core";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * One database handle for three contexts, so `npm run dev` and `npm test`
 * need zero setup:
 *
 *  - production / DATABASE_URL set  → postgres-js against real Postgres
 *  - development, no DATABASE_URL   → PGlite (in-process Postgres) persisted
 *                                     to .data/pglite, migrations auto-run
 *  - test                           → fresh in-memory PGlite per suite
 *
 * PGlite runs the real Postgres engine compiled to WASM, so the SQL that
 * passes tests is the SQL that runs on Fly.
 */
// Both drivers extend PgDatabase; `any` covers the driver-specific HKT slot.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

let instance: Db | undefined;

export async function getDb(): Promise<Db> {
  if (instance) return instance;

  if (env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { default: postgres } = await import("postgres");
    const client = postgres(env.DATABASE_URL, {
      max: 10,
      ...(env.DATABASE_URL.includes("neon.tech") ? { ssl: "require" as const } : {}),
    });
    instance = drizzle(client, { schema });
    return instance;
  }

  if (env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }

  instance = await createPgliteDb(env.NODE_ENV === "test" ? undefined : ".data/pglite");
  return instance;
}

/** Fresh isolated database — used by tests, never by the app path. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dataDir, { recursive: true });
  }
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as Db;
}

/** Test hook: point the app at a suite-scoped database. */
export function setDbForTests(db: Db): void {
  instance = db;
}

export { schema };
