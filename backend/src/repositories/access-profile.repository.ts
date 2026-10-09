import type { Knex } from "knex";
import { db } from "../db/knex.js";
import type { OverageAction } from "../core/constants.js";

export interface AccessProfileRow {
  id: string;
  name: string;
  description: string | null;
  allow_all_models: boolean;
  limit_5h_tokens: string;
  limit_weekly_tokens: string;
  limit_rpm: number;
  max_output_tokens_per_request: number;
  price_idr: number;
  tier_label: string | null;
  overage_action: OverageAction;
  is_default: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface ProfileInput {
  name: string;
  description?: string | null;
  allow_all_models: boolean;
  limit_5h_tokens: number;
  limit_weekly_tokens: number;
  limit_rpm: number;
  max_output_tokens_per_request: number;
  price_idr?: number;
  tier_label?: string | null;
  overage_action?: OverageAction;
  is_default?: boolean;
}

export async function listProfiles(): Promise<AccessProfileRow[]> {
  return db<AccessProfileRow>("access_profiles").whereNull("deleted_at").orderBy("name", "asc");
}

export async function findProfileById(id: string): Promise<AccessProfileRow | undefined> {
  return db<AccessProfileRow>("access_profiles").where({ id }).whereNull("deleted_at").first();
}

export async function findDefaultProfile(): Promise<AccessProfileRow | undefined> {
  return db<AccessProfileRow>("access_profiles")
    .where({ is_default: true })
    .whereNull("deleted_at")
    .first();
}

export async function createProfile(input: ProfileInput, actorId: string): Promise<AccessProfileRow> {
  return db.transaction(async (trx) => {
    if (input.is_default) {
      await trx("access_profiles").where({ is_default: true }).update({ is_default: false });
    }
    const [row] = await trx<AccessProfileRow>("access_profiles")
      .insert({
        name: input.name,
        description: input.description ?? null,
        allow_all_models: input.allow_all_models,
        limit_5h_tokens: String(input.limit_5h_tokens),
        limit_weekly_tokens: String(input.limit_weekly_tokens),
        limit_rpm: input.limit_rpm,
        max_output_tokens_per_request: input.max_output_tokens_per_request,
        price_idr: input.price_idr ?? 0,
        tier_label: input.tier_label ?? null,
        overage_action: input.overage_action ?? "cutoff",
        is_default: input.is_default ?? false,
        created_by: actorId,
        updated_by: actorId,
      })
      .returning("*");
    return row!;
  });
}

export async function updateProfile(
  id: string,
  patch: Partial<ProfileInput>,
  actorId: string,
): Promise<AccessProfileRow | undefined> {
  return db.transaction(async (trx) => {
    if (patch.is_default === true) {
      await trx("access_profiles").where({ is_default: true }).whereNot({ id }).update({ is_default: false });
    }
    const { limit_5h_tokens, limit_weekly_tokens, ...rest } = patch;
    const [row] = await trx<AccessProfileRow>("access_profiles")
      .where({ id })
      .update({
        ...rest,
        ...(limit_5h_tokens !== undefined ? { limit_5h_tokens: String(limit_5h_tokens) } : {}),
        ...(limit_weekly_tokens !== undefined
          ? { limit_weekly_tokens: String(limit_weekly_tokens) }
          : {}),
        updated_by: actorId,
        updated_at: trx.fn.now(),
      })
      .returning("*");
    return row;
  });
}

export async function softDeleteProfile(id: string, actorId: string): Promise<void> {
  await db("access_profiles")
    .where({ id })
    .update({ deleted_at: db.fn.now(), is_default: false, updated_by: actorId, updated_at: db.fn.now() });
}

export async function countUsersForProfile(id: string): Promise<number> {
  const row = await db("users").where({ access_profile_id: id }).whereNull("deleted_at").count<{ count: string }>("* as count").first();
  return Number(row?.count ?? 0);
}

export async function getProfileModelIds(profileId: string): Promise<string[]> {
  const rows = await db("profile_models").where({ profile_id: profileId }).select<{ model_id: string }[]>("model_id");
  return rows.map((row) => row.model_id);
}

export async function setProfileModels(
  profileId: string,
  modelIds: string[],
  actorId: string,
  trx: Knex = db,
): Promise<void> {
  await trx("profile_models").where({ profile_id: profileId }).del();
  if (modelIds.length > 0) {
    await trx("profile_models").insert(
      modelIds.map((modelId) => ({ profile_id: profileId, model_id: modelId, created_by: actorId })),
    );
  }
}

export async function getProfileFeatureIds(profileId: string): Promise<string[]> {
  const rows = await db("profile_features").where({ profile_id: profileId }).select<{ feature_id: string }[]>("feature_id");
  return rows.map((row) => row.feature_id);
}

export async function setProfileFeatures(
  profileId: string,
  featureIds: string[],
  actorId: string,
  trx: Knex = db,
): Promise<void> {
  await trx("profile_features").where({ profile_id: profileId }).del();
  if (featureIds.length > 0) {
    await trx("profile_features").insert(
      featureIds.map((featureId) => ({ profile_id: profileId, feature_id: featureId, created_by: actorId })),
    );
  }
}
