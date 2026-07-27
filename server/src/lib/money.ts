/**
 * Money is integer pence, everywhere, always. The branded type makes it a
 * compile error to pass a raw number (or worse, a float of pounds) where
 * pence are expected.
 */
export type Pence = number & { readonly __brand: "pence" };

export function pence(value: number): Pence {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Money must be integer pence, got ${value}`);
  }
  return value as Pence;
}

/** "£12.40" — en-GB formatting lives in one place. */
export function formatGBP(value: Pence): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value / 100);
}

/** Median of integer-pence values, floored to stay in pence. */
export function medianPence(values: readonly Pence[]): Pence | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (upper === undefined) return null;
  return sorted.length % 2 === 0 && lower !== undefined
    ? pence(Math.floor((lower + upper) / 2))
    : upper;
}

/**
 * Suggested max buy price: median × 0.4. The 0.6 margin covers eBay final
 * value fees (~13%), postage/packaging, the occasional dud, and the profit
 * that makes the flip worth the Sunday morning. Surfaced to the user with a
 * tooltip, not presented as gospel.
 */
export function suggestedMaxBuy(median: Pence): Pence {
  return pence(Math.floor(median * 0.4));
}
