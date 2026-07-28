/** Money is integer pence on the wire and in the UI. Formatting lives here. */

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const gbpWhole = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function formatPence(value: number): string {
  return gbp.format(value / 100);
}

/**
 * Hero numbers drop the pennies above £100 — "£142" reads instantly at
 * arm's length in sunlight; "£142.37" does not. Under £100 the pennies
 * matter (50p finds are the whole point of a boot sale).
 */
export function formatPenceCompact(value: number): string {
  return value >= 10_000 ? gbpWhole.format(value / 100) : gbp.format(value / 100);
}
