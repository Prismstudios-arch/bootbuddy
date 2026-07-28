import { pence, type Pence } from "./money.js";

/**
 * Profit maths, in one place, in integer pence.
 *
 * Realised profit is what actually landed: sale price minus what you paid,
 * minus selling fees, minus postage you covered. Unrealised profit is the
 * optimistic version — current estimated value minus what you paid — and is
 * labelled as an estimate everywhere it appears, because an item is only
 * worth what someone pays for it.
 */
export type FindLike = {
  boughtPricePence: number;
  estimatedValuePence: number | null;
  soldPricePence: number | null;
  feesPence: number;
  postagePence: number;
  status: "in_stock" | "sold";
};

export function realisedProfit(find: FindLike): Pence | null {
  if (find.status !== "sold" || find.soldPricePence === null) return null;
  return pence(find.soldPricePence - find.boughtPricePence - find.feesPence - find.postagePence);
}

export function unrealisedProfit(find: FindLike): Pence | null {
  if (find.status !== "in_stock" || find.estimatedValuePence === null) return null;
  return pence(find.estimatedValuePence - find.boughtPricePence);
}

/**
 * Margin as a percentage of the sale price (revenue), which is how resellers
 * and eBay itself talk about it — "40% margin" means 40p of every pound
 * taken was profit. Returns null rather than dividing by zero on a freebie.
 */
export function marginPercent(find: FindLike): number | null {
  const profit = realisedProfit(find);
  if (profit === null || !find.soldPricePence) return null;
  return (profit / find.soldPricePence) * 100;
}

/** eBay's final value fee is ~13% of the total sale. Used as the default. */
export const DEFAULT_FEE_PERCENT = 13;

export function estimateFees(soldPricePence: number, feePercent = DEFAULT_FEE_PERCENT): Pence {
  return pence(Math.round((soldPricePence * feePercent) / 100));
}
