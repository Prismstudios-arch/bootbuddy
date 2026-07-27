import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env.js";

/**
 * Verifies a Sign in with Apple identity token against Apple's published
 * JWKS. Returns the stable `sub` (our link key) or null. The JWKS client
 * caches keys and refreshes on rotation, so this is one network hop at
 * most per key lifetime.
 */
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export type AppleIdentity = { sub: string; email?: string };

export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<AppleIdentity | null> {
  try {
    const { payload } = await jwtVerify(identityToken, appleJwks, {
      issuer: "https://appleid.apple.com",
      audience: env.APPLE_BUNDLE_ID,
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      ...(typeof payload.email === "string" ? { email: payload.email } : {}),
    };
  } catch {
    return null;
  }
}
