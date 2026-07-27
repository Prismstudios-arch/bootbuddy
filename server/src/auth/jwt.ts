import { jwtVerify, SignJWT } from "jose";
import { env } from "../env.js";

const ISSUER = "boot-sale-buddy";
const ACCESS_TTL_SECONDS = 60 * 60; // 1h — short-lived; refresh does the rest

function secret(): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret());
}

/** Returns the user id, or null for anything invalid/expired — never throws. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: ISSUER,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
