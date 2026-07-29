import { useEffect, useRef } from "react";
import { useSession } from "@/api/scans";
import { getPurchases } from "./index";

/**
 * Tells the store who is buying, once we know.
 *
 * This is not optional plumbing. RevenueCat generates its own anonymous id
 * unless told otherwise, and our webhook looks the incoming `app_user_id`
 * up against our users table. Without this, a purchase would go through,
 * take someone's money, and unlock nothing — the webhook would log
 * "unknown_user" and move on.
 *
 * Passing our own user UUID means the entitlement lands on the right
 * account, and it keeps working when the same person signs in with Apple
 * later, because signing in links that account rather than replacing it.
 */
export function usePurchasesIdentity(): void {
  const session = useSession();
  const userId = session.data?.user.id;
  const configuredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || configuredFor.current === userId) return;
    configuredFor.current = userId;
    void getPurchases()
      .configure(userId)
      .catch(() => {
        // Failing to reach the store isn't fatal — the paywall falls back
        // to the local catalogue and simply can't complete a purchase.
        configuredFor.current = null;
      });
  }, [userId]);
}
