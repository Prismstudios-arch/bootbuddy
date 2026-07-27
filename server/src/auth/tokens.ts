import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";

const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * Refresh tokens: 48 random bytes, stored only as a SHA-256 hash (a DB leak
 * can't mint sessions), rotated on every use. Rotation links the old row to
 * its replacement; presenting an already-rotated token is treated as theft
 * and revokes the whole family — the legitimate device re-authenticates,
 * the attacker gets nothing.
 */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(
  db: Db,
  userId: string,
  familyId: string = randomUUID(),
): Promise<string> {
  const token = randomBytes(48).toString("base64url");
  await db.insert(schema.refreshTokens).values({
    userId,
    tokenHash: hash(token),
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return token;
}

export type RotateResult =
  | { ok: true; userId: string; refreshToken: string }
  | { ok: false; reason: "invalid" | "expired" | "reused" };

export async function rotateRefreshToken(db: Db, presented: string): Promise<RotateResult> {
  const [row] = await db
    .select()
    .from(schema.refreshTokens)
    .where(eq(schema.refreshTokens.tokenHash, hash(presented)))
    .limit(1);

  if (!row) return { ok: false, reason: "invalid" };

  if (row.replacedBy !== null) {
    // Replay of a rotated token — burn the family.
    await db
      .delete(schema.refreshTokens)
      .where(eq(schema.refreshTokens.familyId, row.familyId));
    return { ok: false, reason: "reused" };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.id, row.id));
    return { ok: false, reason: "expired" };
  }

  const next = randomBytes(48).toString("base64url");
  const [inserted] = await db
    .insert(schema.refreshTokens)
    .values({
      userId: row.userId,
      tokenHash: hash(next),
      familyId: row.familyId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    })
    .returning({ id: schema.refreshTokens.id });

  await db
    .update(schema.refreshTokens)
    .set({ replacedBy: inserted?.id ?? null })
    .where(and(eq(schema.refreshTokens.id, row.id), eq(schema.refreshTokens.familyId, row.familyId)));

  return { ok: true, userId: row.userId, refreshToken: next };
}
