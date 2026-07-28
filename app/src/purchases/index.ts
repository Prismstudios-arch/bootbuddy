import Constants from "expo-constants";
import { MockPurchases } from "./mock";
import type { PurchasesProvider } from "./types";

export * from "./types";
export { MockPurchases } from "./mock";

/**
 * Picks the implementation once, at startup.
 *
 * Expo Go reports `appOwnership === "expo"`, and its runtime has no native
 * RevenueCat module — so we use the mock there. Anything else is a dev
 * client or a store build, where the real provider is loaded lazily (its
 * import lives inside RevenueCatPurchases so this module stays safe to
 * import in Expo Go).
 */
let provider: PurchasesProvider | undefined;

export function getPurchases(): PurchasesProvider {
  if (provider) return provider;

  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) {
    provider = new MockPurchases();
    return provider;
  }

  try {
    // Only reached in a native build; require keeps it out of the Expo Go graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RevenueCatPurchases } = require("./revenuecat") as {
      RevenueCatPurchases: new () => PurchasesProvider;
    };
    provider = new RevenueCatPurchases();
  } catch {
    // A dev build without the library installed yet — degrade rather than crash.
    provider = new MockPurchases();
  }
  return provider;
}
