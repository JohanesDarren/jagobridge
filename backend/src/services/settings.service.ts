import { AppError } from "../core/errors.js";
import { loadEnv } from "../core/env.js";
import { getAllSettings, upsertSetting } from "../repositories/settings.repository.js";
import { isUpstreamConfigured, listUpstreamModels } from "../gateway/upstream-client.js";
import { getLastSuccessfulSyncAt } from "../repositories/model.repository.js";
import { recordAudit } from "./audit.service.js";
import type { RequestMeta } from "./auth.service.js";

const env = loadEnv();

export const SETTING_KEYS = {
  defaultTimezone: "default_timezone",
  modelSyncIntervalMinutes: "model_sync_interval_minutes",
  playgroundRetentionDays: "playground_retention_days",
  maxInflightRequestsPerUser: "max_inflight_requests_per_user",
} as const;

const RANGES = {
  modelSyncIntervalMinutes: { min: 15, max: 1440 },
  playgroundRetentionDays: { min: 7, max: 365 },
  maxInflightRequestsPerUser: { min: 1, max: 20 },
};

export interface SettingsDto {
  default_timezone: string;
  model_sync_interval_minutes: number;
  playground_retention_days: number;
  max_inflight_requests_per_user: number;
  upstream: {
    base_url: string;
    configured: boolean;
    last_successful_sync_at: string | null;
  };
}

export async function getSettingsDto(): Promise<SettingsDto> {
  const settings = await getAllSettings();
  const lastSync = await getLastSuccessfulSyncAt();
  return {
    default_timezone: (settings[SETTING_KEYS.defaultTimezone] as string) ?? env.DEFAULT_TIMEZONE,
    model_sync_interval_minutes:
      (settings[SETTING_KEYS.modelSyncIntervalMinutes] as number) ?? env.MODEL_SYNC_INTERVAL_MINUTES,
    playground_retention_days:
      (settings[SETTING_KEYS.playgroundRetentionDays] as number) ?? env.PLAYGROUND_RETENTION_DAYS,
    max_inflight_requests_per_user:
      (settings[SETTING_KEYS.maxInflightRequestsPerUser] as number) ?? env.MAX_INFLIGHT_REQUESTS_PER_USER,
    upstream: {
      base_url: env.UPSTREAM_BASE_URL,
      configured: isUpstreamConfigured(),
      last_successful_sync_at: lastSync ? lastSync.toISOString() : null,
    },
  };
}

export async function getMaxInflightRequestsPerUser(): Promise<number> {
  const settings = await getAllSettings();
  const value = settings[SETTING_KEYS.maxInflightRequestsPerUser];
  return typeof value === "number" ? value : env.MAX_INFLIGHT_REQUESTS_PER_USER;
}

export interface UpdateSettingsPatch {
  default_timezone?: string;
  model_sync_interval_minutes?: number;
  playground_retention_days?: number;
  max_inflight_requests_per_user?: number;
}

export async function updateSettings(
  patch: UpdateSettingsPatch,
  actorId: string,
  meta: RequestMeta,
): Promise<SettingsDto> {
  if (Object.keys(patch).length === 0) {
    throw new AppError(400, "NO_FIELDS_PROVIDED", "No fields were provided");
  }

  const before = await getSettingsDto();
  const errors: Record<string, string[]> = {};

  const checkRange = (key: keyof typeof RANGES, value: number | undefined, field: string) => {
    if (value === undefined) return;
    const range = RANGES[key];
    if (value < range.min || value > range.max) {
      errors[field] = [`Must be between ${range.min} and ${range.max}`];
    }
  };

  checkRange("modelSyncIntervalMinutes", patch.model_sync_interval_minutes, "model_sync_interval_minutes");
  checkRange("playgroundRetentionDays", patch.playground_retention_days, "playground_retention_days");
  checkRange("maxInflightRequestsPerUser", patch.max_inflight_requests_per_user, "max_inflight_requests_per_user");

  if (patch.default_timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: patch.default_timezone });
    } catch {
      errors.default_timezone = ["Unknown IANA timezone"];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed", errors);
  }

  if (patch.default_timezone !== undefined) {
    await upsertSetting(SETTING_KEYS.defaultTimezone, patch.default_timezone, actorId);
  }
  if (patch.model_sync_interval_minutes !== undefined) {
    await upsertSetting(SETTING_KEYS.modelSyncIntervalMinutes, patch.model_sync_interval_minutes, actorId);
  }
  if (patch.playground_retention_days !== undefined) {
    await upsertSetting(SETTING_KEYS.playgroundRetentionDays, patch.playground_retention_days, actorId);
  }
  if (patch.max_inflight_requests_per_user !== undefined) {
    await upsertSetting(SETTING_KEYS.maxInflightRequestsPerUser, patch.max_inflight_requests_per_user, actorId);
  }

  const after = await getSettingsDto();
  await recordAudit({
    actorUserId: actorId,
    action: "settings.update",
    targetType: "system_settings",
    targetId: null,
    beforeState: {
      default_timezone: before.default_timezone,
      model_sync_interval_minutes: before.model_sync_interval_minutes,
      playground_retention_days: before.playground_retention_days,
      max_inflight_requests_per_user: before.max_inflight_requests_per_user,
    },
    afterState: {
      default_timezone: after.default_timezone,
      model_sync_interval_minutes: after.model_sync_interval_minutes,
      playground_retention_days: after.playground_retention_days,
      max_inflight_requests_per_user: after.max_inflight_requests_per_user,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return after;
}

export interface ConnectionTestResult {
  success: boolean;
  status: number;
  message: string;
}

/** Calls the upstream /models endpoint and reports the HTTP status (PRD F-12). */
export async function testUpstreamConnection(): Promise<ConnectionTestResult> {
  if (!isUpstreamConfigured()) {
    return { success: false, status: 0, message: "Upstream base URL or API key is not configured" };
  }
  try {
    const result = await listUpstreamModels();
    if (result.ok) {
      const count = result.data?.data?.length ?? 0;
      return { success: true, status: result.status, message: `Connected. ${count} models reported.` };
    }
    return { success: false, status: result.status, message: `Upstream returned HTTP ${result.status}` };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: error instanceof Error ? error.message : "Upstream unreachable",
    };
  }
}
