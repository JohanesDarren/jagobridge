import { db } from "../db/knex.js";

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export async function listApiKeysByUser(userId: string): Promise<ApiKeyRow[]> {
  return db<ApiKeyRow>("api_keys")
    .where({ user_id: userId })
    .whereNull("deleted_at")
    .orderBy("created_at", "desc");
}

export async function findApiKeyById(id: string): Promise<ApiKeyRow | undefined> {
  return db<ApiKeyRow>("api_keys").where({ id }).whereNull("deleted_at").first();
}

export async function findActiveKeyByHash(hash: string): Promise<ApiKeyRow | undefined> {
  return db<ApiKeyRow>("api_keys")
    .where({ key_hash: hash })
    .whereNull("revoked_at")
    .whereNull("deleted_at")
    .first();
}

export async function countActiveKeys(userId: string): Promise<number> {
  const row = await db("api_keys")
    .where({ user_id: userId })
    .whereNull("revoked_at")
    .whereNull("deleted_at")
    .where((builder) => builder.whereNull("expires_at").orWhere("expires_at", ">", db.fn.now()))
    .count<{ count: string }>("* as count")
    .first();
  return Number(row?.count ?? 0);
}

export async function createApiKey(input: {
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  expiresAt: Date | null;
}): Promise<ApiKeyRow> {
  const [row] = await db<ApiKeyRow>("api_keys")
    .insert({
      user_id: input.userId,
      name: input.name,
      key_prefix: input.keyPrefix,
      key_hash: input.keyHash,
      expires_at: input.expiresAt,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .returning("*");
  return row!;
}

export async function revokeApiKey(id: string, actorId: string): Promise<ApiKeyRow | undefined> {
  const [row] = await db<ApiKeyRow>("api_keys")
    .where({ id })
    .whereNull("revoked_at")
    .update({ revoked_at: db.fn.now(), updated_by: actorId, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

export async function revokeAllKeysForUser(userId: string): Promise<void> {
  await db("api_keys")
    .where({ user_id: userId })
    .whereNull("revoked_at")
    .update({ revoked_at: db.fn.now(), updated_at: db.fn.now() });
}

export async function touchApiKeyLastUsed(id: string): Promise<void> {
  await db("api_keys").where({ id }).update({ last_used_at: db.fn.now() });
}
