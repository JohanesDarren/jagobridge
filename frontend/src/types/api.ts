export type Role = "admin" | "member";
export type WindowState = "unlimited" | "ok" | "warning" | "exceeded";
export type FeatureCode = "streaming" | "tool_calling" | "vision_input" | "json_mode";
export type OverageAction = "cutoff" | "allow";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface SuccessEnvelope<T> {
  status: "success";
  message: string;
  data: T;
}

export interface PaginatedEnvelope<T> extends SuccessEnvelope<T[]> {
  meta: PaginationMeta;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  must_change_password: boolean;
  usage_notice_acknowledged: boolean;
}

export interface UserQuotaUsage {
  five_hour: { used_tokens: number; limit_tokens: number };
  weekly: { used_tokens: number; limit_tokens: number };
}

export interface User {
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
  /** Present on the list endpoint (quota bars). */
  usage?: UserQuotaUsage;
}

export interface WindowUsage {
  used_tokens: number;
  limit_tokens: number;
  remaining_tokens: number;
  reset_at: string | null;
  state: WindowState;
}

export interface MeResponse {
  user: User;
  limits: {
    limit_5h_tokens: number;
    limit_weekly_tokens: number;
    limit_rpm: number;
    max_output_tokens_per_request: number;
  };
  features: FeatureCode[];
  windows: { five_hour: WindowUsage; weekly: WindowUsage };
}

export interface AccessProfile {
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

export interface Model {
  id: string;
  upstream_id: string;
  public_name: string;
  display_name: string;
  provider_label: string | null;
  capabilities: {
    tool_calling?: boolean;
    vision_input?: boolean;
    json_mode?: boolean;
    context_length?: number;
  };
  token_multiplier: number;
  is_enabled: boolean;
  is_available: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelCatalogResponse {
  models: Model[];
  sync: { last_successful_sync_at: string | null };
}

export interface SyncResult {
  added: number;
  updated: number;
  marked_unavailable: number;
  duration_ms: number;
  synced_at: string;
}

export interface Feature {
  id: string;
  code: FeatureCode;
  name: string;
  description: string | null;
  is_enabled: boolean;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  status: "active" | "revoked" | "expired";
  created_at: string;
}

export interface CreatedApiKey extends ApiKey {
  key: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  access_profile_id: string;
  expires_at: string;
  created_at: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invite_url?: string;
}

export interface UsageEvent {
  id: string;
  request_id: string;
  user_id?: string;
  user_email?: string | null;
  user_name?: string | null;
  model_public_name: string;
  source: "api" | "playground";
  status: "success" | "upstream_error" | "client_cancelled";
  /** HTTP status from 9router; null when the request never got a response. */
  upstream_status: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  token_multiplier: number;
  weighted_tokens: number;
  usage_estimated: boolean;
  latency_ms: number | null;
  created_at: string;
}

export interface UsageStats {
  range: { from: string; to: string };
  totals: {
    weighted_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    cached_tokens: number;
    requests: number;
    errors: number;
    avg_latency_ms: number;
    client_4xx: number;
    server_5xx: number;
  };
  by_model: Array<{
    model_public_name: string;
    weighted_tokens: number;
    requests: number;
    latency?: { p50: number | null; p95: number | null };
  }>;
  by_user: Array<{ user_id: string; weighted_tokens: number; requests: number }>;
  by_provider: Array<{
    provider: string;
    requests: number;
    weighted_tokens: number;
    avg_latency_ms: number;
  }>;
  by_status_code: Array<{ upstream_status: number | null; requests: number }>;
  daily: Array<UsageBucket & { day: string }>;
  hourly: Array<UsageBucket & { hour: string }>;
  latency: { p50: number | null; p95: number | null };
}

export interface UsageBucket {
  weighted_tokens: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  services: {
    database: "healthy" | "unhealthy";
    redis: "healthy" | "unhealthy";
    upstream_9router: "healthy" | "degraded";
  };
}

export interface Settings {
  default_timezone: string;
  model_sync_interval_minutes: number;
  playground_retention_days: number;
  max_inflight_requests_per_user: number;
  upstream: { base_url: string; configured: boolean; last_successful_sync_at: string | null };
}

export interface ConnectionTest {
  success: boolean;
  status: number;
  message: string;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface UserDetail {
  user: User;
  effective: {
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
  };
}
