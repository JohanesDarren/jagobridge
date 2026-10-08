import { redis } from "../db/redis.js";
import type { FeatureCode, OverrideEffect, Role } from "../core/constants.js";
import type { UserRow } from "../repositories/user.repository.js";
import type { ModelRow } from "../repositories/model.repository.js";
import {
  findProfileById,
  getProfileFeatureIds,
  getProfileModelIds,
} from "../repositories/access-profile.repository.js";
import { getUserModelOverrides } from "../repositories/model.repository.js";
import { getUserFeatureOverrides, listFeatures } from "../repositories/feature.repository.js";
import { db } from "../db/knex.js";

export interface EffectiveLimits {
  limit5hTokens: number;
  limitWeeklyTokens: number;
  limitRpm: number;
  maxOutputTokensPerRequest: number;
}

export interface EffectiveAccess {
  userId: string;
  isActive: boolean;
  role: Role;
  profileId: string | null;
  allowAllModels: boolean;
  allowedModelIds: string[];
  allowedFeatureCodes: FeatureCode[];
  modelOverrides: Record<string, OverrideEffect>;
  featureOverrides: Record<string, OverrideEffect>;
  limits: EffectiveLimits;
}

const ACCESS_CACHE_TTL_SECONDS = 60;
const accessCacheKey = (userId: string) => `access:user:${userId}`;

// ---------------------------------------------------------------------------
// Effective access resolution
// ---------------------------------------------------------------------------

/** Resolves the effective access of a user, using a short-lived Redis cache. */
export async function resolveEffectiveAccess(user: UserRow): Promise<EffectiveAccess> {
  const cached = await redis.get(accessCacheKey(user.id));
  if (cached) {
    try {
      return JSON.parse(cached) as EffectiveAccess;
    } catch {
      // fall through to recompute on corrupt cache
    }
  }

  const profile = user.access_profile_id ? await findProfileById(user.access_profile_id) : undefined;
  const [profileModelIds, profileFeatureIds, features, modelOverrides, featureOverrides] =
    await Promise.all([
      profile ? getProfileModelIds(profile.id) : Promise.resolve<string[]>([]),
      profile ? getProfileFeatureIds(profile.id) : Promise.resolve<string[]>([]),
      listFeatures(),
      getUserModelOverrides(user.id),
      getUserFeatureOverrides(user.id),
    ]);

  const featureCodeById = new Map(features.map((feature) => [feature.id, feature.code]));
  const allowedFeatureCodes = profileFeatureIds
    .map((id) => featureCodeById.get(id))
    .filter((code): code is FeatureCode => Boolean(code));

  const parseOverride = (value: string | null | undefined): number | null => {
    if (value === null || value === undefined || value === "") return null;
    return Number(value);
  };

  const override5h = parseOverride(user.limit_5h_tokens_override);
  const overrideWeekly = parseOverride(user.limit_weekly_tokens_override);
  const overrideRpm = parseOverride(
    user.limit_rpm_override === null || user.limit_rpm_override === undefined
      ? null
      : String(user.limit_rpm_override),
  );

  const access: EffectiveAccess = {
    userId: user.id,
    isActive: user.is_active,
    role: user.role,
    profileId: profile?.id ?? null,
    allowAllModels: profile?.allow_all_models ?? false,
    allowedModelIds: profileModelIds,
    allowedFeatureCodes,
    modelOverrides: Object.fromEntries(modelOverrides.map((row) => [row.model_id, row.effect])),
    featureOverrides: Object.fromEntries(
      featureOverrides
        .map((row) => {
          const code = featureCodeById.get(row.feature_id);
          return code ? ([code, row.effect] as const) : null;
        })
        .filter((entry): entry is readonly [FeatureCode, OverrideEffect] => entry !== null),
    ),
    limits: {
      limit5hTokens: override5h ?? Number(profile?.limit_5h_tokens ?? 0),
      limitWeeklyTokens: overrideWeekly ?? Number(profile?.limit_weekly_tokens ?? 0),
      limitRpm: overrideRpm ?? profile?.limit_rpm ?? 0,
      maxOutputTokensPerRequest: profile?.max_output_tokens_per_request ?? 0,
    },
  };

  await redis.set(accessCacheKey(user.id), JSON.stringify(access), "EX", ACCESS_CACHE_TTL_SECONDS);
  return access;
}

// ---------------------------------------------------------------------------
// Pure rules (unit-testable, PRD F-06 §4.3)
// ---------------------------------------------------------------------------

/**
 * Effective access rule: user override, then profile, then default deny.
 * Disabled, unavailable, or deleted models are denied to everyone.
 */
export function canUseModel(access: EffectiveAccess, model: ModelRow): boolean {
  if (!access.isActive) return false;
  if (model.deleted_at !== null) return false;
  if (!model.is_enabled) return false;
  if (!model.is_available) return false;

  const override = access.modelOverrides[model.id];
  if (override) return override === "allow";

  if (access.allowAllModels) return true;
  return access.allowedModelIds.includes(model.id);
}

/** Feature entitlements use the same precedence as models (PRD F-07). */
export function canUseFeature(access: EffectiveAccess, code: FeatureCode): boolean {
  if (!access.isActive) return false;
  const override = access.featureOverrides[code];
  if (override) return override === "allow";
  return access.allowedFeatureCodes.includes(code);
}

export function isModelFeatureSupported(
  model: ModelRow,
  code: FeatureCode,
): boolean {
  switch (code) {
    case "streaming":
      return true;
    case "tool_calling":
      return truthyOrUnknown(model.capabilities.tool_calling);
    case "vision_input":
      return truthyOrUnknown(model.capabilities.vision_input);
    case "json_mode":
      return truthyOrUnknown(model.capabilities.json_mode);
    default:
      return true;
  }
}

/** `undefined` capability means unknown -> allow the request through (PRD F-07). */
function truthyOrUnknown(value: boolean | undefined): boolean {
  return value === undefined ? true : value;
}

// ---------------------------------------------------------------------------
// Cache invalidation (changes must apply within 60s — hard TTL guarantees it)
// ---------------------------------------------------------------------------

export async function invalidateAccessCache(userId: string): Promise<void> {
  await redis.del(accessCacheKey(userId));
}

export async function invalidateAccessCacheForProfile(profileId: string): Promise<void> {
  const users = await db("users")
    .where({ access_profile_id: profileId })
    .whereNull("deleted_at")
    .select<{ id: string }[]>("id");
  if (users.length === 0) return;
  await redis.del(...users.map((user) => accessCacheKey(user.id)));
}

export async function invalidateAllAccessCaches(): Promise<void> {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "access:user:*", "COUNT", 200);
    cursor = nextCursor;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== "0");
}
