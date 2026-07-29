import { Alert, Linking } from "react-native";
import { haptic } from "./haptics";

/**
 * Every outbound link goes through here.
 *
 * `Linking.openURL` REJECTS when iOS can't handle a URL — no mail account
 * configured, an App Store URL inside Expo Go, a dead scheme. Calling it as
 * `void Linking.openURL(...)` turns that into an unhandled promise
 * rejection, which surfaces as a red "Uncaught (in promise) Error: Unable to
 * open URL" banner in dev and simply does nothing in production. Neither
 * tells the user anything useful.
 */
export async function openUrl(url: string, failureMessage?: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    haptic.fail();
    Alert.alert(
      "Couldn't open that",
      failureMessage ?? "Your phone wouldn't open that link. Try again later?",
    );
  }
}

/** Apple's subscription management screen — not reachable from Expo Go. */
export const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

export async function openAppleSubscriptions(): Promise<void> {
  await openUrl(
    APPLE_SUBSCRIPTIONS_URL,
    "Manage your subscription in the Settings app → your name → Subscriptions. (This link only works in a real build, not Expo Go.)",
  );
}

export async function openSupportEmail(): Promise<void> {
  await openUrl(
    "mailto:bootsalebuddy@outlook.com?subject=Boot%20Sale%20Buddy",
    "No mail app is set up on this phone. You can reach us at bootsalebuddy@outlook.com.",
  );
}
