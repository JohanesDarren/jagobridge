import type { OverageAction } from "../core/constants.js";
import { AppError } from "../core/errors.js";
import {
  countUsersForProfile,
  createProfile,
  findProfileById,
  getProfileFeatureIds,
  getProfileModelIds,
  listProfiles,
  setProfileFeatures,
  setProfileModels,
  softDeleteProfile,
  updateProfile,
  type AccessProfileRow,
  type ProfileInput,
} from "../repositories/access-profile.repository.js";
import { findModelsByIds, listModels } from "../repositories/model.repository.js";
import { listFeatures } from "../repositories/feature.repository.js";
import { recordAudit } from "./audit.service.js";
import { invalidateAccessCacheForProfile } from "./access.service.js";
import type { RequestMeta } from "./auth.service.js";

export interface ProfileDto {
  id: string;
  name: string;
  description: string | null;
  allow_all_models: boolean;
  limit_5h_tokens: number;
  limit_weekly_tokens: number;
  limit_rpm: number;
  max_output_tokens_per_request: number;
  price_idr: number;
  tier_label: string | null;
  overage_action: OverageAction;
  is_default: boolean;
  user_count?: number;
  model_ids?: string[];
  feature_ids?: string[];
  features?: string[];
  created_at: string;
  updated_at: string;
}

export function toProfileDto(profile: AccessProfileRow): ProfileDto {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    allow_all_models: profile.allow_all_models,
    limit_5h_tokens: Number(profile.limit_5h_tokens),
    limit_weekly_tokens: Number(profile.limit_weekly_tokens),
    limit_rpm: profile.limit_rpm,
    max_output_tokens_per_request: profile.max_output_tokens_per_request,
    price_idr: Number(profile.price_idr ?? 0),
    tier_label: profile.tier_label,
    overage_action: profile.overage_action ?? "cutoff",
    is_default: profile.is_default,
    created_at: profile.created_at.toISOString(),
    updated_at: profile.updated_at.toISOString(),
  };
}

export async function listProfilesDto(): Promise<ProfileDto[]> {
  const profiles = await listProfiles();
  const counts = await Promise.all(profiles.map((profile) => countUsersForProfile(profile.id)));
  return profiles.map((profile, index) => ({ ...toProfileDto(profile), user_count: counts[index] ?? 0 }));
}

export async function getProfileDetail(id: string): Promise<ProfileDto> {
  const profile = await findProfileById(id);
  if (!profile) throw new AppError(404, "NOT_FOUND", "Access profile not found");
  const [modelIds, featureIds, features, userCount] = await Promise.all([
    getProfileModelIds(id),
    getProfileFeatureIds(id),
    listFeatures(),
    countUsersForProfile(id),
  ]);
  const featureCodeById = new Map(features.map((feature) => [feature.id, feature.code]));
  return {
    ...toProfileDto(profile),
    model_ids: modelIds,
    feature_ids: featureIds,
    features: featureIds.map((featureId) => featureCodeById.get(featureId) ?? "").filter(Boolean),
    user_count: userCount,
  };
}

export async function createProfileService(input: ProfileInput, actorId: string, meta: RequestMeta): Promise<ProfileDto> {
  const name = input.name.trim();
  const existing = (await listProfiles()).find((profile) => profile.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    throw new AppError(409, "VALIDATION_ERROR", "A profile with this name already exists", {
      name: ["Profile name must be unique"],
    });
  }
  const created = await createProfile({ ...input, name }, actorId);
  await recordAudit({
    actorUserId: actorId,
    action: "access_profile.create",
    targetType: "access_profile",
    targetId: created.id,
    afterState: {
      name: created.name,
      price_idr: Number(created.price_idr ?? 0),
      tier_label: created.tier_label,
      overage_action: created.overage_action,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return toProfileDto(created);
}

export async function updateProfileService(
  id: string,
  patch: Partial<ProfileInput>,
  actorId: string,
  meta: RequestMeta,
): Promise<ProfileDto> {
  const profile = await findProfileById(id);
  if (!profile) throw new AppError(404, "NOT_FOUND", "Access profile not found");

  if (patch.name) {
    const name = patch.name.trim();
    const duplicate = (await listProfiles()).find(
      (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      throw new AppError(409, "VALIDATION_ERROR", "A profile with this name already exists", {
        name: ["Profile name must be unique"],
      });
    }
  }

  const updated = await updateProfile(id, { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) }, actorId);
  if (!updated) throw new AppError(404, "NOT_FOUND", "Access profile not found");

  await invalidateAccessCacheForProfile(id);
  await recordAudit({
    actorUserId: actorId,
    action: "access_profile.update",
    targetType: "access_profile",
    targetId: id,
    beforeState: {
      limit_5h_tokens: Number(profile.limit_5h_tokens),
      limit_weekly_tokens: Number(profile.limit_weekly_tokens),
      limit_rpm: profile.limit_rpm,
      max_output_tokens_per_request: profile.max_output_tokens_per_request,
      price_idr: Number(profile.price_idr ?? 0),
      tier_label: profile.tier_label,
      overage_action: profile.overage_action,
      allow_all_models: profile.allow_all_models,
      is_default: profile.is_default,
    },
    afterState: {
      limit_5h_tokens: Number(updated.limit_5h_tokens),
      limit_weekly_tokens: Number(updated.limit_weekly_tokens),
      limit_rpm: updated.limit_rpm,
      max_output_tokens_per_request: updated.max_output_tokens_per_request,
      price_idr: Number(updated.price_idr ?? 0),
      tier_label: updated.tier_label,
      overage_action: updated.overage_action,
      allow_all_models: updated.allow_all_models,
      is_default: updated.is_default,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return toProfileDto(updated);
}

export async function setProfileModelsService(
  id: string,
  allowAllModels: boolean,
  modelIds: string[],
  actorId: string,
  meta: RequestMeta,
): Promise<ProfileDto> {
  const profile = await findProfileById(id);
  if (!profile) throw new AppError(404, "NOT_FOUND", "Access profile not found");

  const uniqueIds = [...new Set(modelIds)];
  const found = await findModelsByIds(uniqueIds);
  if (found.length !== uniqueIds.length) {
    throw new AppError(400, "VALIDATION_ERROR", "One or more model IDs are invalid", {
      model_ids: ["Each model ID must exist and not be deleted"],
    });
  }

  await setProfileModels(id, uniqueIds, actorId);
  await updateProfile(id, { allow_all_models: allowAllModels }, actorId);
  await invalidateAccessCacheForProfile(id);

  await recordAudit({
    actorUserId: actorId,
    action: "access_profile.models_update",
    targetType: "access_profile",
    targetId: id,
    afterState: { allow_all_models: allowAllModels, model_count: uniqueIds.length },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return getProfileDetail(id);
}

export async function setProfileFeaturesService(
  id: string,
  featureIds: string[],
  actorId: string,
  meta: RequestMeta,
): Promise<ProfileDto> {
  const profile = await findProfileById(id);
  if (!profile) throw new AppError(404, "NOT_FOUND", "Access profile not found");

  const uniqueIds = [...new Set(featureIds)];
  const features = await listFeatures();
  const validIds = new Set(features.map((feature) => feature.id));
  if (uniqueIds.some((featureId) => !validIds.has(featureId))) {
    throw new AppError(400, "VALIDATION_ERROR", "One or more feature IDs are invalid", {
      feature_ids: ["Each feature ID must exist"],
    });
  }

  await setProfileFeatures(id, uniqueIds, actorId);
  await invalidateAccessCacheForProfile(id);

  await recordAudit({
    actorUserId: actorId,
    action: "access_profile.features_update",
    targetType: "access_profile",
    targetId: id,
    afterState: { feature_count: uniqueIds.length },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return getProfileDetail(id);
}

export async function deleteProfileService(id: string, actorId: string, meta: RequestMeta): Promise<void> {
  const profile = await findProfileById(id);
  if (!profile) throw new AppError(404, "NOT_FOUND", "Access profile not found");

  const userCount = await countUsersForProfile(id);
  if (userCount > 0) {
    throw new AppError(409, "PROFILE_IN_USE", "Profile is assigned to users and cannot be deleted", {
      user_count: [String(userCount)],
    });
  }

  await softDeleteProfile(id, actorId);
  await invalidateAccessCacheForProfile(id);
  await recordAudit({
    actorUserId: actorId,
    action: "access_profile.delete",
    targetType: "access_profile",
    targetId: id,
    beforeState: { name: profile.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
}

/** Returns models for the profile matrix UI (only selectable models). */
export async function listSelectableModels(): Promise<Array<{ id: string; public_name: string; display_name: string }>> {
  const models = await listModels();
  return models.map((model) => ({
    id: model.id,
    public_name: model.public_name,
    display_name: model.display_name,
  }));
}
