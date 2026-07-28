/**
 * The seam that keeps the app runnable in Expo Go.
 *
 * RevenueCat needs a native module that Expo Go can't load, so every
 * purchase path goes through this interface. `MockPurchases` runs in Expo
 * Go (and in tests); `RevenueCatPurchases` takes over in EAS dev/production
 * builds. The paywall UI is identical either way, so it's fully designable
 * and testable without a build.
 */
export type Entitlement = "free" | "pro" | "lifetime";

export type PackageId = "monthly" | "annual" | "lifetime";

export type Offering = {
  id: PackageId;
  title: string;
  /** Formatted for display, e.g. "£12.99". Never do maths on this. */
  priceLabel: string;
  /** e.g. "per year" */
  periodLabel: string;
  /** Free trial length in days, if the package offers one. */
  trialDays?: number;
  /** e.g. "Works out at £1.08 a month" */
  subtitle?: string;
  highlight?: boolean;
};

export type PurchaseOutcome =
  | { status: "purchased"; entitlement: Entitlement }
  | { status: "restored"; entitlement: Entitlement }
  | { status: "cancelled" }
  | { status: "nothing_to_restore" }
  | { status: "error"; message: string };

export interface PurchasesProvider {
  /** Identify the buyer to the store so the webhook can map back to a user. */
  configure(appUserId: string): Promise<void>;
  getOfferings(): Promise<Offering[]>;
  purchase(packageId: PackageId): Promise<PurchaseOutcome>;
  /** App Review requires this to be reachable without buying anything. */
  restore(): Promise<PurchaseOutcome>;
  /** True when running the mock — the dev menu keys off this. */
  readonly isMock: boolean;
}

/**
 * Pricing copy lives here so the paywall and the App Store listing can't
 * drift apart. Real prices come from the store at runtime in a native
 * build; these are the fallbacks and the mock's values.
 */
export const CATALOGUE: Offering[] = [
  {
    id: "annual",
    title: "Yearly",
    priceLabel: "£12.99",
    periodLabel: "per year",
    trialDays: 7,
    subtitle: "About £1.08 a month — less than one good flip a year",
    highlight: true,
  },
  {
    id: "monthly",
    title: "Monthly",
    priceLabel: "£1.99",
    periodLabel: "per month",
  },
  {
    id: "lifetime",
    title: "Lifetime",
    priceLabel: "£29.99",
    periodLabel: "one-off",
    subtitle: "Pay once, keep it forever",
  },
];
