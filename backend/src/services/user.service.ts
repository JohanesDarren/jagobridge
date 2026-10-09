import { AppError } from "../core/errors.js";
import {
  FIVE_HOUR_WINDOW_SECONDS,
  WEEKLY_WINDOW_SECONDS,
  type Role,
} from "../core/constants.js";
import {
  anonymizeUser,
  countActiveAdmins,
  createUser,
  findUserById,
  listUsers,
  updateUser,
  type ListUsersFilter,
  type UserRow,
} from "../repositories/user.repository.js";
import { findProfileById, listProfiles } from "../repositories/access-profile.repository.js";
import { revokeAllKeysForUser } from "../repositories/api-key.repository.js";
import { revokeAllForUser } from "../repositories/refresh-token.repository.js";
import { generateTemporaryPassword, hashPassword } from "../core/security.js";
import { recordAudit } from "./audit.service.js";
import { sendPasswordResetEmail } from "./email.service.js";
import { invalidateAccessCache, resolveEffectiveAccess } from "./access.service.js";
import { getUserModelOverrides, listModels } from "../repositories/model.repository.js";
import { canUseModel, canUseFeature } from "./access.service.js";
import { getUserFeatureOverrides, listFeatures } from "../repositories/feature.repository.js";
import { sumWeightedTokensByUser } from "../repositories/usage.repository.js";
import type { RequestMeta } from "./auth.service.js";

export interface UserQuotaUsage {
  five_hour: { used_tokens: number; limit_tokens: number };
  weekly: { used_tokens: number; limit_tokens: number };
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  access_profile_id: string | null;
  access_profile_name: string | null;
  limit_5h_tokens_override: number | null;
  limit_weekly_tokens_override: number | null;
  limit_rpm_override: number | null;
  is_active: boolean;
  must_change_password: boolean;
  usage_notice_acknowledged: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  /** Present on the list endpoint so the console can render quota bars. */
  usage?: UserQuotaUsage;
}

export function toUserDto(user: UserRow, profileName: string | null = null): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    access_profile_id: user.access_profile_id,
    access_profile_name: profileName,
    limit_5h_tokens_override:
      user.limit_5h_tokens_override === null ? null : Number(user.limit_5h_tokens_override),
    limit_weekly_tokens_override:
      user.limit_weekly_tokens_override === null ? null : Number(user.limit_weekly_tokens_override),
    limit_rpm_override: user.limit_rpm_override,
    is_active: user.is_active,
    must_change_password: user.must_change_password,
    usage_notice_acknowledged: user.usage_notice_acknowledged,
    last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
}

async function profileNameMap(): Promise<Map<string, string>> {
  const profiles = await listProfiles();
  return new Map(profiles.map((profile) => [profile.id, profile.name]));
}

export async function listUsersDto(
  filter: ListUsersFilter,
  pagination: { offset: number; limit: number },
): Promise<{ users: UserDto[]; total: number }> {
  const [{ rows, total }, names] = await Promise.all([listUsers(filter, pagination), profileNameMap()]);
  const ids = rows.map((row) => row.id);

  const [fiveHourTotals, weeklyTotals, accesses] = await Promise.all([
    sumWeightedTokensByUser(ids, FIVE_HOUR_WINDOW_SECONDS),
    sumWeightedTokensByUser(ids, WEEKLY_WINDOW_SECONDS),
    Promise.all(rows.map((row) => resolveEffectiveAccess(row))),
  ]);

  return {
    users: rows.map((row, index) => ({
      ...toUserDto(row, row.access_profile_id ? names.get(row.access_profile_id) ?? null : null),
      usage: {
        five_hour: {
          used_tokens: fiveHourTotals.get(row.id) ?? 0,
          limit_tokens: accesses[index]?.limits.limit5hTokens ?? 0,
        },
        weekly: {
          used_tokens: weeklyTotals.get(row.id) ?? 0,
          limit_tokens: accesses[index]?.limits.limitWeeklyTokens ?? 0,
        },
      },
    })),
    total,
  };
}

export interface EffectiveAccessDto {
  user_id: string;
  models: Array<{ id: string; public_name: string; display_name: string }>;
  features: string[];
  model_overrides: Array<{ model_id: string; effect: "allow" | "deny" }>;
  feature_overrides: Array<{ feature_id: string; effect: "allow" | "deny" }>;
  limits: {
    limit_5h_tokens: number;
    limit_weekly_tokens: number;
    limit_rpm: number;
    max_output_tokens_per_request: number;
  };
}

export async function getUserDetail(id: string): Promise<{ user: UserDto; effective: EffectiveAccessDto }> {
  const user = await findUserById(id);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const [access, models, features, names, rawModelOverrides, rawFeatureOverrides] = await Promise.all([
    resolveEffectiveAccess(user),
    listModels(),
    listFeatures(),
    profileNameMap(),
    getUserModelOverrides(id),
    getUserFeatureOverrides(id),
  ]);

  const usableModels = models
    .filter((model) => canUseModel(access, model))
    .map((model) => ({ id: model.id, public_name: model.public_name, display_name: model.display_name }));

  const featureCodes = features
    .filter((feature) => canUseFeature(access, feature.code))
    .map((feature) => feature.code);

  return {
    user: toUserDto(user, user.access_profile_id ? names.get(user.access_profile_id) ?? null : null),
    effective: {
      user_id: user.id,
      models: usableModels,
      features: featureCodes,
      model_overrides: rawModelOverrides.map((row) => ({ model_id: row.model_id, effect: row.effect })),
      feature_overrides: rawFeatureOverrides.map((row) => ({ feature_id: row.feature_id, effect: row.effect })),
      limits: {
        limit_5h_tokens: access.limits.limit5hTokens,
        limit_weekly_tokens: access.limits.limitWeeklyTokens,
        limit_rpm: access.limits.limitRpm,
        max_output_tokens_per_request: access.limits.maxOutputTokensPerRequest,
      },
    },
  };
}

export interface UpdateUserPatch {
  access_profile_id?: string | null;
  is_active?: boolean;
  name?: string;
  role?: Role;
  limit_5h_tokens_override?: number | null;
  limit_weekly_tokens_override?: number | null;
  limit_rpm_override?: number | null;
}

export async function updateUserByAdmin(
  id: string,
  patch: UpdateUserPatch,
  actorId: string,
  meta: RequestMeta,
): Promise<UserDto> {
  const user = await findUserById(id);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  if (patch.access_profile_id) {
    const profile = await findProfileById(patch.access_profile_id);
    if (!profile) {
      throw new AppError(400, "VALIDATION_ERROR", "Access profile not found", {
        access_profile_id: ["Access profile not found"],
      });
    }
  }

  if (patch.is_active === false) {
    if (user.id === actorId) {
      throw new AppError(422, "LAST_ADMIN", "You cannot deactivate your own account");
    }
    if (user.role === "admin") {
      const otherAdmins = await countActiveAdmins(user.id);
      if (otherAdmins === 0) {
        throw new AppError(422, "LAST_ADMIN", "Cannot deactivate the last active admin");
      }
    }
  }

  if (patch.role && patch.role !== "admin" && user.role === "admin") {
    const otherAdmins = await countActiveAdmins(user.id);
    if (otherAdmins === 0) {
      throw new AppError(422, "LAST_ADMIN", "Cannot remove the last active admin");
    }
  }

  const before: Record<string, unknown> = {
    access_profile_id: user.access_profile_id,
    is_active: user.is_active,
    role: user.role,
    limit_5h_tokens_override: user.limit_5h_tokens_override,
    limit_weekly_tokens_override: user.limit_weekly_tokens_override,
    limit_rpm_override: user.limit_rpm_override,
  };

  const updated = await updateUser(id, {
    ...(patch.access_profile_id !== undefined ? { access_profile_id: patch.access_profile_id } : {}),
    ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.limit_5h_tokens_override !== undefined
      ? {
          limit_5h_tokens_override:
            patch.limit_5h_tokens_override === null ? null : String(patch.limit_5h_tokens_override),
        }
      : {}),
    ...(patch.limit_weekly_tokens_override !== undefined
      ? {
          limit_weekly_tokens_override:
            patch.limit_weekly_tokens_override === null ? null : String(patch.limit_weekly_tokens_override),
        }
      : {}),
    ...(patch.limit_rpm_override !== undefined ? { limit_rpm_override: patch.limit_rpm_override } : {}),
    updated_by: actorId,
    updated_at: new Date(),
  });

  if (!updated) throw new AppError(404, "NOT_FOUND", "User not found");

  if (patch.is_active === false) {
    await revokeAllKeysForUser(id);
    await revokeAllForUser(id, "admin");
  }

  await invalidateAccessCache(id);

  const names = await profileNameMap();
  const dto = toUserDto(updated, updated.access_profile_id ? names.get(updated.access_profile_id) ?? null : null);

  await recordAudit({
    actorUserId: actorId,
    action: patch.is_active === false ? "user.deactivate" : "user.update",
    targetType: "user",
    targetId: id,
    beforeState: before,
    afterState: {
      access_profile_id: dto.access_profile_id,
      is_active: dto.is_active,
      role: dto.role,
      limit_5h_tokens_override: dto.limit_5h_tokens_override,
      limit_weekly_tokens_override: dto.limit_weekly_tokens_override,
      limit_rpm_override: dto.limit_rpm_override,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return dto;
}

export async function resetUserPassword(
  id: string,
  actorId: string,
  meta: RequestMeta,
): Promise<{ temporary_password: string }> {
  const user = await findUserById(id);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await updateUser(id, {
    password_hash: passwordHash,
    must_change_password: true,
    failed_login_count: 0,
    locked_until: null,
    updated_by: actorId,
    updated_at: new Date(),
  });
  await revokeAllForUser(id, "admin");
  await sendPasswordResetEmail(user.email, temporaryPassword);

  await recordAudit({
    actorUserId: actorId,
    action: "user.password_reset",
    targetType: "user",
    targetId: id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return { temporary_password: temporaryPassword };
}

export async function deleteUser(id: string, actorId: string, meta: RequestMeta): Promise<void> {
  const user = await findUserById(id);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  if (user.id === actorId) {
    throw new AppError(422, "LAST_ADMIN", "You cannot delete your own account");
  }
  if (user.role === "admin") {
    const otherAdmins = await countActiveAdmins(user.id);
    if (otherAdmins === 0) {
      throw new AppError(422, "LAST_ADMIN", "Cannot delete the last active admin");
    }
  }

  await revokeAllKeysForUser(id);
  await revokeAllForUser(id, "admin");
  await anonymizeUser(id);
  await invalidateAccessCache(id);

  await recordAudit({
    actorUserId: actorId,
    action: "user.delete",
    targetType: "user",
    targetId: id,
    beforeState: { email: user.email, role: user.role },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function createFirstAdmin(name: string, email: string, password: string): Promise<UserRow> {
  const existing = await countActiveAdmins();
  if (existing > 0) {
    throw new Error("An active admin already exists. Use the console to invite more users.");
  }
  const profiles = await listProfiles();
  // Admins should start with full access: prefer the unlimited profile.
  const adminProfile =
    profiles.find((profile) => profile.allow_all_models) ??
    profiles.find((profile) => profile.is_default) ??
    profiles[0];
  const passwordHash = await hashPassword(password);
  return createUser({
    name,
    email,
    passwordHash,
    role: "admin",
    accessProfileId: adminProfile?.id ?? null,
    mustChangePassword: false,
  });
}
