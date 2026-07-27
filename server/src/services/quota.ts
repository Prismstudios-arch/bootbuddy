import { and, eq, gte, sql, sum } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import type { AuthedUser } from "../auth/middleware.js";

/**
 * Scan quotas — the backend decides, always. Free: 3/day, resetting at
 * midnight UK (Europe/London, so BST/GMT handled by the tz database, not
 * by us). Pro/lifetime: 1,000/month fair-use cap so a leaked token can't
 * torch the Anthropic bill. Client-side quota display is cosmetic.
 */
export const FREE_SCANS_PER_DAY = 3;
export const PRO_SCANS_PER_MONTH = 1000;

export type QuotaState = {
  used: number;
  limit: number;
  period: "day" | "month";
  resetsAt: string; // ISO timestamp of next UK midnight (day) / month start
};

/** YYYY-MM-DD in Europe/London, whatever the server's own timezone is. */
export function ukDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function ukMonthStartDay(now: Date = new Date()): string {
  return `${ukDay(now).slice(0, 8)}01`;
}

/** Next UK midnight as a real instant, DST-safe. */
export function nextUkMidnight(now: Date = new Date()): Date {
  // Walk forward from `now` in hour steps until the UK calendar day changes,
  // then binary-search the minute. Crude, allocation-free of tz maths bugs.
  const today = ukDay(now);
  let lo = now.getTime();
  let hi = lo;
  while (ukDay(new Date(hi)) === today) hi += 60 * 60 * 1000;
  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2);
    if (ukDay(new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  const d = new Date(hi);
  d.setUTCSeconds(0, 0);
  return d;
}

function isPro(user: AuthedUser, now: Date): boolean {
  if (user.entitlement === "lifetime") return true;
  if (user.entitlement !== "pro") return false;
  return user.entitlementExpiresAt === null || user.entitlementExpiresAt.getTime() > now.getTime();
}

export async function getQuota(db: Db, user: AuthedUser, now = new Date()): Promise<QuotaState> {
  if (isPro(user, now)) {
    const [row] = await db
      .select({ total: sum(schema.usage.scanCount) })
      .from(schema.usage)
      .where(and(eq(schema.usage.userId, user.id), gte(schema.usage.day, ukMonthStartDay(now))));
    return {
      used: Number(row?.total ?? 0),
      limit: PRO_SCANS_PER_MONTH,
      period: "month",
      resetsAt: nextUkMonthStart(now).toISOString(),
    };
  }
  const [row] = await db
    .select({ count: schema.usage.scanCount })
    .from(schema.usage)
    .where(and(eq(schema.usage.userId, user.id), eq(schema.usage.day, ukDay(now))));
  return {
    used: row?.count ?? 0,
    limit: FREE_SCANS_PER_DAY,
    period: "day",
    resetsAt: nextUkMidnight(now).toISOString(),
  };
}

function nextUkMonthStart(now: Date): Date {
  let probe = nextUkMidnight(now);
  while (!ukDay(probe).endsWith("-01")) probe = nextUkMidnight(probe);
  return probe;
}

/**
 * Atomically consume one scan. The upsert increments under the daily PK, so
 * two concurrent scans can't both sneak under the limit — we increment
 * first and refund on over-limit, which under race resolves to at most one
 * extra 429, never an extra billed scan.
 */
export async function consumeScan(
  db: Db,
  user: AuthedUser,
  now = new Date(),
): Promise<{ allowed: boolean; quota: QuotaState }> {
  const day = ukDay(now);
  await db
    .insert(schema.usage)
    .values({ userId: user.id, day, scanCount: 1 })
    .onConflictDoUpdate({
      target: [schema.usage.userId, schema.usage.day],
      set: { scanCount: sql`${schema.usage.scanCount} + 1` },
    });

  const quota = await getQuota(db, user, now);
  if (quota.used > quota.limit) {
    await db
      .update(schema.usage)
      .set({ scanCount: sql`${schema.usage.scanCount} - 1` })
      .where(and(eq(schema.usage.userId, user.id), eq(schema.usage.day, day)));
    return { allowed: false, quota: { ...quota, used: quota.used - 1 } };
  }
  return { allowed: true, quota };
}
