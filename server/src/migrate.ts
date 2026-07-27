import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "./env.js";

/**
 * Runs as the Fly release command (see fly.toml) before new machines take
 * traffic, so schema and code never drift. `max: 1` because migrations must
 * not run concurrently.
 */
async function main() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL required to migrate");
  const client = postgres(env.DATABASE_URL, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
