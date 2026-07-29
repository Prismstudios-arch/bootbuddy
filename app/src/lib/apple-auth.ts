import * as AppleAuthentication from "expo-apple-authentication";
import { API_URL, ApiError, setSession } from "./api";

/**
 * Sign in with Apple — the difference between "my phone died and I lost two
 * years of profit history" and "I signed back in".
 *
 * Everything runs on an anonymous device account by design: no login wall,
 * you can scan within seconds of installing. But that account lives in the
 * Keychain, so deleting the app loses it. For something people track real
 * money in over months, that's a genuine risk rather than a theoretical one.
 *
 * Signing in is therefore offered, never forced, and it LINKS the existing
 * anonymous account rather than replacing it — the server does that when we
 * pass the current bearer token — so nobody loses the finds they logged
 * before signing in.
 */
export type AppleSignInResult =
  | { status: "signed_in" }
  | { status: "cancelled" }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(currentToken: string | null): Promise<AppleSignInResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) {
      return { status: "error", message: "Apple didn't return a sign-in token." };
    }

    const res = await fetch(`${API_URL}/v1/auth/apple`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Passing the current session is what lets the server attach this
        // Apple ID to the anonymous account instead of starting a new one.
        ...(currentToken ? { authorization: `Bearer ${currentToken}` } : {}),
      },
      body: JSON.stringify({ identityToken: credential.identityToken }),
    });

    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const err = (body as { error?: { message?: string } } | null)?.error;
      throw new ApiError(res.status, "apple_failed", err?.message ?? "Couldn't sign you in.");
    }

    const session = (await res.json()) as { accessToken: string; refreshToken: string };
    await setSession(session.accessToken, session.refreshToken);
    return { status: "signed_in" };
  } catch (error) {
    // The user tapping Cancel is not a failure and must not look like one.
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      return { status: "cancelled" };
    }
    if (error instanceof ApiError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Couldn't sign you in. Try again?" };
  }
}
