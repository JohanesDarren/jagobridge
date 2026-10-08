import type { Knex } from "knex";
import { db } from "../db/knex.js";

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: "rotated" | "logout" | "reuse" | "admin" | null;
  created_at: Date;
  user_agent: string | null;
}

export async function createRefreshToken(
  input: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string | null },
  trx: Knex = db,
): Promise<RefreshTokenRow> {
  const [row] = await trx<RefreshTokenRow>("refresh_tokens")
    .insert({
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      user_agent: input.userAgent ? input.userAgent.slice(0, 255) : null,
    })
    .returning("*");
  return row!;
}

export async function findByTokenHash(
  tokenHash: string,
  trx: Knex = db,
): Promise<RefreshTokenRow | undefined> {
  return trx<RefreshTokenRow>("refresh_tokens").where({ token_hash: tokenHash }).first();
}

export async function revokeToken(
  id: string,
  reason: "rotated" | "logout" | "reuse" | "admin",
  trx: Knex = db,
): Promise<void> {
  await trx("refresh_tokens").where({ id }).whereNull("revoked_at").update({
    revoked_at: trx.fn.now(),
    revoked_reason: reason,
  });
}

export async function revokeAllForUser(
  userId: string,
  reason: "rotated" | "logout" | "reuse" | "admin",
  trx: Knex = db,
): Promise<number> {
  return trx("refresh_tokens")
    .where({ user_id: userId })
    .whereNull("revoked_at")
    .update({ revoked_at: trx.fn.now(), revoked_reason: reason });
}

export async function deleteExpiredBefore(date: Date): Promise<number> {
  return db("refresh_tokens").where("expires_at", "<", date).del();
}
