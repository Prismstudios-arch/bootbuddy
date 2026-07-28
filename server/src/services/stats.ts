import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { marginPercent, realisedProfit, unrealisedProfit } from "../lib/profit.js";

/**
 * Profit aggregates for the Profit tab. Computed in JS from the user's own
 * rows rather than SQL aggregates: a heavy booter has a few hundred finds,
 * the maths is identical on every database, and month bucketing stays in
 * Europe/London without wrestling Postgres timezones.
 */
export type MonthPoint = { month: string; profitPence: number; sales: number };

export type Stats = {
  realisedProfitPence: number;
  unrealisedProfitPence: number;
  thisMonthPence: number;
  lastMonthPence: number;
  totalSpentPence: number;
  totalRevenuePence: number;
  averageMarginPercent: number | null;
  inStockCount: number;
  soldCount: number;
  bestFlip: {
    id: string;
    name: string;
    profitPence: number;
    boughtPricePence: number;
    soldPricePence: number;
    soldAt: string | null;
  } | null;
  /** Last 6 months, oldest first — the sparkline. */
  monthly: MonthPoint[];
};

/** "2026-07" in Europe/London. */
function ukMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (mon ?? 1) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function computeStats(db: Db, userId: string, now = new Date()): Promise<Stats> {
  const finds = await db.select().from(schema.finds).where(eq(schema.finds.userId, userId));

  const stats: Stats = {
    realisedProfitPence: 0,
    unrealisedProfitPence: 0,
    thisMonthPence: 0,
    lastMonthPence: 0,
    totalSpentPence: 0,
    totalRevenuePence: 0,
    averageMarginPercent: null,
    inStockCount: 0,
    soldCount: 0,
    bestFlip: null,
    monthly: [],
  };

  const thisMonth = ukMonth(now);
  const lastMonth = shiftMonth(thisMonth, -1);
  const byMonth = new Map<string, MonthPoint>();
  const margins: number[] = [];

  for (const find of finds) {
    stats.totalSpentPence += find.boughtPricePence;

    if (find.status === "sold") {
      stats.soldCount += 1;
      stats.totalRevenuePence += find.soldPricePence ?? 0;

      const profit = realisedProfit(find) ?? 0;
      stats.realisedProfitPence += profit;

      const margin = marginPercent(find);
      if (margin !== null) margins.push(margin);

      const soldMonth = ukMonth(find.soldAt ?? find.updatedAt);
      if (soldMonth === thisMonth) stats.thisMonthPence += profit;
      if (soldMonth === lastMonth) stats.lastMonthPence += profit;

      const point = byMonth.get(soldMonth) ?? { month: soldMonth, profitPence: 0, sales: 0 };
      point.profitPence += profit;
      point.sales += 1;
      byMonth.set(soldMonth, point);

      if (
        find.soldPricePence !== null &&
        (stats.bestFlip === null || profit > stats.bestFlip.profitPence)
      ) {
        stats.bestFlip = {
          id: find.id,
          name: find.name,
          profitPence: profit,
          boughtPricePence: find.boughtPricePence,
          soldPricePence: find.soldPricePence,
          soldAt: find.soldAt?.toISOString() ?? null,
        };
      }
    } else {
      stats.inStockCount += 1;
      stats.unrealisedProfitPence += unrealisedProfit(find) ?? 0;
    }
  }

  stats.averageMarginPercent =
    margins.length > 0
      ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10
      : null;

  // Always emit six buckets so the chart has a stable shape from day one.
  for (let i = 5; i >= 0; i--) {
    const month = shiftMonth(thisMonth, -i);
    stats.monthly.push(byMonth.get(month) ?? { month, profitPence: 0, sales: 0 });
  }

  return stats;
}
