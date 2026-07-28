import { apiFetch } from "@/lib/api";
import {
  CATALOGUE,
  type Entitlement,
  type Offering,
  type PackageId,
  type PurchasesProvider,
  type PurchaseOutcome,
} from "./types";

/**
 * Expo Go implementation. No store, no native module — it calls the
 * development-only entitlement endpoint so the *server* still becomes the
 * source of truth, exactly as in production. That means the whole upgrade
 * path (paywall → purchase → quota lifts to 1,000/month) is genuinely
 * exercised in Expo Go rather than faked in local state.
 *
 * The dev endpoint is not mounted on the production API, so this provider
 * simply fails there — which is the correct outcome, since a real build
 * uses RevenueCatPurchases anyway.
 */
export class MockPurchases implements PurchasesProvider {
  readonly isMock = true;

  async configure(): Promise<void> {
    // Nothing to configure without a store.
  }

  async getOfferings(): Promise<Offering[]> {
    return CATALOGUE;
  }

  async purchase(packageId: PackageId): Promise<PurchaseOutcome> {
    const entitlement: Entitlement = packageId === "lifetime" ? "lifetime" : "pro";
    // A beat of latency so loading states are visible while designing.
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await apiFetch("/v1/dev/entitlement", {
        method: "POST",
        body: JSON.stringify({ entitlement }),
      });
      return { status: "purchased", entitlement };
    } catch {
      return {
        status: "error",
        message: "Mock purchases need a local dev server (they're disabled in production).",
      };
    }
  }

  async restore(): Promise<PurchaseOutcome> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { status: "nothing_to_restore" };
  }

  /** Dev menu only: drop back to free to re-test the paywall. */
  async reset(): Promise<void> {
    await apiFetch("/v1/dev/entitlement", {
      method: "POST",
      body: JSON.stringify({ entitlement: "free" }),
    });
  }
}
