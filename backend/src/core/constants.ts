/**
 * Named constants. No magic numbers (PRD §7.1).
 * Times are stored in UTC.
 */

export const FIVE_HOUR_WINDOW_SECONDS = 5 * 60 * 60;
export const WEEKLY_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const RPM_WINDOW_SECONDS = 60;

export const SECONDS_PER_MINUTE = 60;
export const MILLIS_PER_SECOND = 1000;
export const MILLIS_PER_MINUTE = SECONDS_PER_MINUTE * MILLIS_PER_SECOND;

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export const API_KEY_PREFIX = "jb_";
export const API_KEY_RANDOM_LENGTH = 40;
export const API_KEY_PREFIX_DISPLAY_LENGTH = 11; // "jb_" + 8 characters
export const MAX_ACTIVE_API_KEYS_PER_USER = 10;
export const API_KEY_MAX_EXPIRY_DAYS = 365;

export const INVITATION_TOKEN_BYTES = 32;

export const FEATURE_CODES = ["streaming", "tool_calling", "vision_input", "json_mode"] as const;
export type FeatureCode = (typeof FEATURE_CODES)[number];

export const USAGE_SOURCES = ["api", "playground"] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

export const USAGE_STATUSES = ["success", "upstream_error", "client_cancelled"] as const;
export type UsageStatus = (typeof USAGE_STATUSES)[number];

export const ROLES = ["admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const OVERRIDE_EFFECTS = ["allow", "deny"] as const;
export type OverrideEffect = (typeof OVERRIDE_EFFECTS)[number];

export const QUOTA_WARNING_THRESHOLD = 0.8; // 80%
export const QUOTA_EXCEEDED_THRESHOLD = 1.0; // 100%

export const PASSWORD_MIN_LENGTH = 10;

export const MAX_EXPORT_DAYS = 90;
export const MAX_EXPORT_ROWS = 500_000;

export const UPSTREAM_MODELS_PATH = "/models";
export const UPSTREAM_CHAT_COMPLETIONS_PATH = "/chat/completions";
export const HEALTH_UPSTREAM_CACHE_SECONDS = 30;

export const CHARS_PER_ESTIMATED_TOKEN = 4;

export const PUBLIC_NAME_PATTERN = /^[a-z0-9][a-z0-9./-]{0,99}$/;

export const RETRY_AFTER_HEADER = "Retry-After";
