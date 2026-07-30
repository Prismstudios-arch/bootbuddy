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

/**
 * Which StoreKit the SDK talks to.
 *
 * react-native-purchases 10 defaults to StoreKit 2, and StoreKit 2 only
 * works if an In-App Purchase Key (.p8) has been uploaded to RevenueCat —
 * its own docs carry the warning. Without that key a purchase fails with
 * PRODUCT_NOT_AVAILABLE_FOR_PURCHASE, which reads like an App Store
 * problem and sends you off checking agreements and territories.
 *
 * StoreKit 1 needs no key, so it's the default here: the paywall works out
 * of the box and can be tested before any of that is set up. Once the key
 * is in RevenueCat, set EXPO_PUBLIC_STOREKIT_VERSION=STOREKIT_2 in the
 * build profile — StoreKit 2 is the better long-term choice.
 *
 * String literals rather than the SDK enum on purpose: it's a string enum,
 * and importing it eagerly would drag the native module into the Expo Go
 * bundle, which is the one thing this whole provider exists to avoid.
 */
const STORE_KIT_VERSION =
  process.env.EXPO_PUBLIC_STOREKIT_VERSION === "STOREKIT_2" ? "STOREKIT_2" : "STOREKIT_1";

type PurchasesModule = any;

type StoreError = {
  userCancelled?: boolean;
  readableErrorCode?: string;
  code?: string | number;
  message?: string;
  underlyingErrorMessage?: string;
  /** react-native-purchases puts the useful fields in here on iOS. */
  userInfo?: {
    userCancelled?: boolean;
    readableErrorCode?: string;
    code?: string | number;
    message?: string;
    underlyingErrorMessage?: string;
    NSUnderlyingError?: { localizedDescription?: string };
  };
};

/**
 * Flatten the two shapes the SDK throws.
 *
 * Build 7 surfaced a bare "Couldn't complete that purchase." with no code
 * appended, which only happens when readableErrorCode is undefined — and it
 * is undefined at the top level, because on iOS the SDK nests everything
 * under `userInfo`. Reading only the top level threw away the one piece of
 * information the message existed to carry.
 */
function flatten(error: StoreError) {
  const info = error.userInfo ?? {};
  return {
    cancelled: error.userCancelled ?? info.userCancelled ?? false,
    code: error.readableErrorCode ?? info.readableErrorCode,
    numericCode: error.code ?? info.code,
    detail:
      error.underlyingErrorMessage ??
      info.underlyingErrorMessage ??
      info.NSUnderlyingError?.localizedDescription ??
      error.message ??
      info.message,
  };
}

/**
 * Why the purchase failed, in words, plus the code when we haven't got words
 * for it.
 *
 * "Couldn't complete that purchase." was true and completely useless: for a
 * one-man app it turns every failure into an unanswerable support email, and
 * it hid the difference between "the App Store is down" and "these products
 * were never set up". RevenueCat already tells us which; there is no reason
 * to throw that away.
 */
const ERROR_COPY: Record<string, string> = {
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE:
    "That plan isn't on sale in your App Store country yet.",
  PRODUCT_ALREADY_PURCHASED: "You already own this one — tap Restore purchases.",
  RECEIPT_ALREADY_IN_USE:
    "This purchase is already tied to another account. Tap Restore purchases.",
  PURCHASE_NOT_ALLOWED: "This Apple ID isn't allowed to buy — check Screen Time restrictions.",
  PURCHASE_INVALID: "The App Store turned that payment down. Check your payment method.",
  PAYMENT_PENDING: "Your payment is waiting on approval. We'll unlock Pro once it clears.",
  STORE_PROBLEM: "The App Store is having a moment. Give it a minute and try again.",
  NETWORK_ERROR: "Couldn't reach the App Store. Check your signal?",
  OFFLINE_CONNECTION_ERROR: "You're offline. Try again when you've got signal.",
  CONFIGURATION_ERROR:
    "Buddy Pro isn't set up properly on our end. That's ours to fix — drop us a line.",
  INVALID_CREDENTIALS_ERROR:
    "Buddy Pro isn't set up properly on our end. That's ours to fix — drop us a line.",
  INELIGIBLE_ERROR: "You've had the free trial already — pick a plan to carry on.",
  OPERATION_ALREADY_IN_PROGRESS: "There's already a purchase going through. Hang on a sec.",
};

/**
 * RevenueCat's readable codes mostly have no "_ERROR" suffix — the real one
 * that came back was PRODUCT_NOT_AVAILABLE_FOR_PURCHASE, not
 * PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR, so every guessed key above
 * missed and the user got the raw code instead of a sentence. Look up both
 * spellings rather than betting on which convention a given code follows.
 */
function copyFor(code: string): string | undefined {
  return ERROR_COPY[code] ?? ERROR_COPY[code.replace(/_ERROR$/, "")];
}

function storeErrorMessage(error: StoreError, fallback: string): string {
  const { code, numericCode, detail } = flatten(error);
  const friendly = code ? copyFor(code) : undefined;
  if (friendly) return friendly;

  // Unmapped: show whatever we've got. Ugly on screen, but it turns "it
  // doesn't work" into something that can be looked up, and a paywall that
  // fails anonymously is unfixable for whoever's on the other end of it.
  const clue = code ?? (numericCode !== undefined ? `code ${numericCode}` : null);
  if (clue && detail) return `${fallback} (${clue}: ${detail})`;
  if (clue) return `${fallback} (${clue})`;
  if (detail) return `${fallback} (${detail})`;
  return fallback;
}

export class RevenueCatPurchases implements PurchasesProvider {
  readonly isMock = false;
  private purchases: PurchasesModule | undefined;

  private async module(): Promise<PurchasesModule> {
    this.purchases ??= (await import("react-native-purchases")).default;
    return this.purchases;
  }

  async configure(appUserId: string): Promise<void> {
    const Purchases = await this.module();
    // Verbose logging while the store side is still being sorted out. It
    // prints the StoreKit product fetch, the storefront, and the real reason
    // a purchase was refused — none of which reaches the app as anything
    // more than an error code, and all of which is the difference between
    // fixing this and guessing at it.
    try {
      Purchases.setLogLevel("VERBOSE");
    } catch {
      // Older SDKs take an enum rather than a string; not worth failing over.
    }
    // appUserId is our own user UUID, so the webhook can map the purchase
    // straight back to the account without a second lookup.
    Purchases.configure({
      apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
      appUserID: appUserId,
      storeKitVersion: STORE_KIT_VERSION,
    });
    console.warn(`RevenueCat configured with ${STORE_KIT_VERSION}`);
  }

  async getOfferings(): Promise<Offering[]> {
    try {
      const Purchases = await this.module();
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      if (packages.length === 0) {
        // Falling back to our own copy means the paywall shows plausible
        // prices for products the store has never heard of, and the failure
        // only shows up when someone tries to buy. Say so in the log.
        console.warn("no RevenueCat packages in the current offering — showing fallback prices");
        return CATALOGUE;
      }

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
    } catch (error) {
      console.warn("couldn't load offerings", JSON.stringify(flatten(error as StoreError)));
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
        : {
            status: "error",
            message:
              "The App Store took the payment but Pro didn't unlock. Tap Restore purchases in a minute.",
          };
    } catch (error) {
      const err = error as StoreError;
      // RevenueCat flags a user-initiated cancel; that isn't an error.
      if (flatten(err).cancelled) return { status: "cancelled" };
      console.warn("purchase failed", JSON.stringify(flatten(err)));
      return { status: "error", message: storeErrorMessage(err, "Couldn't complete that purchase.") };
    }
  }

  async restore(): Promise<PurchaseOutcome> {
    try {
      const Purchases = await this.module();
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]
        ? { status: "restored", entitlement: "pro" }
        : { status: "nothing_to_restore" };
    } catch (error) {
      const err = error as StoreError;
      console.warn("restore failed", JSON.stringify(flatten(err)));
      return { status: "error", message: storeErrorMessage(err, "Couldn't restore purchases.") };
    }
  }
}
