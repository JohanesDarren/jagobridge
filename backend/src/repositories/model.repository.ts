import type { Knex } from "knex";
import { db } from "../db/knex.js";

export interface ModelCapabilities {
  tool_calling?: boolean;
  vision_input?: boolean;
  json_mode?: boolean;
  context_length?: number;
}

export interface ModelRow {
  id: string;
  upstream_id: string;
  public_name: string;
  display_name: string;
  provider_label: string | null;
  capabilities: ModelCapabilities;
  token_multiplier: string;
  is_enabled: boolean;
  is_available: boolean;
  last_synced_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export async function listModels(includeDeleted = false): Promise<ModelRow[]> {
  const query = db<ModelRow>("models").orderBy("public_name", "asc");
  if (!includeDeleted) query.whereNull("deleted_at");
  return query;
}

export async function listAvailableEnabledModels(): Promise<ModelRow[]> {
  return db<ModelRow>("models")
    .where({ is_enabled: true, is_available: true })
    .whereNull("deleted_at")
    .orderBy("public_name", "asc");
}

export async function findModelById(id: string): Promise<ModelRow | undefined> {
  return db<ModelRow>("models").where({ id }).whereNull("deleted_at").first();
}

export async function findModelByPublicName(publicName: string): Promise<ModelRow | undefined> {
  return db<ModelRow>("models").where({ public_name: publicName }).whereNull("deleted_at").first();
}

export async function findModelByUpstreamId(upstreamId: string): Promise<ModelRow | undefined> {
  return db<ModelRow>("models").where({ upstream_id: upstreamId }).first();
}

export async function findModelsByIds(ids: string[]): Promise<ModelRow[]> {
  if (ids.length === 0) return [];
  return db<ModelRow>("models").whereIn("id", ids).whereNull("deleted_at");
}

export async function updateModel(
  id: string,
  patch: Partial<{
    public_name: string;
    display_name: string;
    token_multiplier: number;
    is_enabled: boolean;
    is_available: boolean;
    capabilities: ModelCapabilities;
    provider_label: string | null;
    last_synced_at: Date;
    updated_by: string | null;
  }>,
): Promise<ModelRow | undefined> {
  const { token_multiplier, ...rest } = patch;
  const [row] = await db<ModelRow>("models")
    .where({ id })
    .update({
      ...rest,
      ...(token_multiplier !== undefined ? { token_multiplier: String(token_multiplier) } : {}),
      updated_at: db.fn.now(),
    })
    .returning("*");
  return row;
}

export interface UpsertModelInput {
  upstream_id: string;
  display_name: string;
  provider_label: string | null;
  capabilities: ModelCapabilities;
}

/** Inserts new upstream models as disabled, preserving admin settings on existing rows. */
export async function upsertModelsFromSync(
  models: UpsertModelInput[],
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  for (const model of models) {
    const existing = await findModelByUpstreamId(model.upstream_id);
    if (!existing) {
      await db("models").insert({
        upstream_id: model.upstream_id,
        public_name: model.upstream_id,
        display_name: model.display_name,
        provider_label: model.provider_label,
        capabilities: JSON.stringify(model.capabilities),
        is_enabled: false,
        is_available: true,
        last_synced_at: db.fn.now(),
      });
      added += 1;
    } else {
      const changed =
        existing.display_name !== model.display_name ||
        existing.provider_label !== model.provider_label ||
        existing.is_available !== true ||
        existing.deleted_at !== null;
      await db("models").where({ id: existing.id }).update({
        display_name: model.display_name,
        provider_label: model.provider_label,
        is_available: true,
        last_synced_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
      if (changed) updated += 1;
    }
  }
  return { added, updated };
}

/** Marks models missing from the latest upstream list as unavailable (never deleted). */
export async function markModelsUnavailable(upstreamIds: string[]): Promise<number> {
  const query = db("models").where({ is_available: true }).whereNull("deleted_at");
  if (upstreamIds.length > 0) query.whereNotIn("upstream_id", upstreamIds);
  const affected = await query.update({ is_available: false, updated_at: db.fn.now() });
  return Number(affected);
}

export async function getUserModelOverrides(
  userId: string,
  trx: Knex = db,
): Promise<Array<{ model_id: string; effect: "allow" | "deny" }>> {
  return trx("user_model_overrides").where({ user_id: userId }).select("model_id", "effect");
}

export async function replaceUserModelOverrides(
  userId: string,
  overrides: Array<{ modelId: string; effect: "allow" | "deny" }>,
  actorId: string,
  trx: Knex = db,
): Promise<void> {
  await trx("user_model_overrides").where({ user_id: userId }).del();
  if (overrides.length > 0) {
    await trx("user_model_overrides").insert(
      overrides.map((override) => ({
        user_id: userId,
        model_id: override.modelId,
        effect: override.effect,
        created_by: actorId,
      })),
    );
  }
}

export async function replaceUserFeatureOverrides(
  userId: string,
  overrides: Array<{ featureId: string; effect: "allow" | "deny" }>,
  actorId: string,
  trx: Knex = db,
): Promise<void> {
  await trx("user_feature_overrides").where({ user_id: userId }).del();
  if (overrides.length > 0) {
    await trx("user_feature_overrides").insert(
      overrides.map((override) => ({
        user_id: userId,
        feature_id: override.featureId,
        effect: override.effect,
        created_by: actorId,
      })),
    );
  }
}

export async function getLastSuccessfulSyncAt(): Promise<Date | null> {
  const row = await db("models").max<{ max: Date | null }[]>("last_synced_at as max").first();
  return row?.max ?? null;
}
