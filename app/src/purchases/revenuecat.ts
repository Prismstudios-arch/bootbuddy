import {
  CATALOGUE,
  type Offering,
  type PackageId,
  type PurchasesProvider,
  type PurchaseOutcome,
} from "./types";

/**
 * Native-build implementation.
 *
 * `react-native-purchases` is imported lazily and this whole provider is
 * only selected outside Expo Go (see index.ts), so the native module is
 * never touched in Expo Go — where it can't load. The package is installed
 * so the bundle resolves and an EAS build works without further changes.
 *
 * To go live: set EXPO_PUBLIC_REVENUECAT_IOS_KEY, create the `pro`
 * entitlement plus the three packages in the RevenueCat dashboard, point
 * its webhook at POST /v1/webhooks/revenuecat with the Authorization value
 * from REVENUECAT_WEBHOOK_AUTH, and build with EAS. No app code changes —
 * that's the point of the interface.
 */
const PACKAGE_IDENTIFIERS: Record<PackageId, string> = {
  monthly: "$rc_monthly",
  annual: "$rc_annual",
  lifetime: "$rc_lifetime",
};

const ENTITLEMENT_ID = "pro";

type PurchasesModule = any;

export class RevenueCatPurchases implements PurchasesProvider {
  readonly isMock = false;
  private purchases: PurchasesModule | undefined;

  private async module(): Promise<PurchasesModule> {
    this.purchases ??= (await import("react-native-purchases")).default;
    return this.purchases;
  }

  async configure(appUserId: string): Promise<void> {
    const Purchases = await this.module();
    // appUserId is our own user UUID, so the webhook can map the purchase
    // straight back to the account without a second lookup.
    Purchases.configure({
      apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
      appUserID: appUserId,
    });
  }

  async getOfferings(): Promise<Offering[]> {
    try {
      const Purchases = await this.module();
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      if (packages.length === 0) return CATALOGUE;

      // Keep our copy and ordering; take live prices from the store so the
      // paywall is correct in every currency and region.
      return CATALOGUE.map((entry) => {
        const match = packages.find(
          (p: { identifier: string }) => p.identifier === PACKAGE_IDENTIFIERS[entry.id],
        );
        return match?.product?.priceString
          ? { ...entry, priceLabel: match.product.priceString }
          : entry;
      });
    } catch {
      return CATALOGUE;
    }
  }

  async purchase(packageId: PackageId): Promise<PurchaseOutcome> {
    try {
      const Purchases = await this.module();
      const offerings = await Purchases.getOfferings();
      const target = offerings.current?.availablePackages?.find(
        (p: { identifier: string }) => p.identifier === PACKAGE_IDENTIFIERS[packageId],
      );
      if (!target) return { status: "error", message: "That plan isn't available right now." };

      const { customerInfo } = await Purchases.purchasePackage(target);
      const active = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      return active
        ? { status: "purchased", entitlement: packageId === "lifetime" ? "lifetime" : "pro" }
        : { status: "error", message: "The purchase didn't go through." };
    } catch (error) {
      // RevenueCat flags a user-initiated cancel; that isn't an error.
      if ((error as { userCancelled?: boolean }).userCancelled) return { status: "cancelled" };
      return { status: "error", message: "Couldn't complete that purchase." };
    }
  }

  async restore(): Promise<PurchaseOutcome> {
    try {
      const Purchases = await this.module();
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]
        ? { status: "restored", entitlement: "pro" }
        : { status: "nothing_to_restore" };
    } catch {
      return { status: "error", message: "Couldn't restore purchases." };
    }
  }
}
