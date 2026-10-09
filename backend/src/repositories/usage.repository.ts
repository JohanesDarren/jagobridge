import type { Knex } from "knex";
import { db } from "../db/knex.js";
import type { UsageSource, UsageStatus } from "../core/constants.js";

export interface UsageEventRow {
  id: string;
  request_id: string;
  user_id: string;
  api_key_id: string | null;
  model_id: string | null;
  model_public_name: string;
  source: UsageSource;
  status: UsageStatus;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  token_multiplier: string;
  weighted_tokens: string;
  usage_estimated: boolean;
  latency_ms: number | null;
  /** HTTP status returned by 9router; null when the request never got a response. */
  upstream_status: number | null;
  created_at: Date;
}

export interface InsertUsageEventInput {
  requestId: string;
  userId: string;
  apiKeyId: string | null;
  modelId: string | null;
  modelPublicName: string;
  source: UsageSource;
  status: UsageStatus;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  tokenMultiplier: number;
  weightedTokens: number;
  usageEstimated: boolean;
  latencyMs: number | null;
  upstreamStatus: number | null;
}

export async function insertUsageEvent(input: InsertUsageEventInput): Promise<UsageEventRow> {
  const [row] = await db<UsageEventRow>("usage_events")
    .insert({
      request_id: input.requestId,
      user_id: input.userId,
      api_key_id: input.apiKeyId,
      model_id: input.modelId,
      model_public_name: input.modelPublicName,
      source: input.source,
      status: input.status,
      prompt_tokens: input.promptTokens,
      completion_tokens: input.completionTokens,
      cached_tokens: input.cachedTokens,
      token_multiplier: String(input.tokenMultiplier),
      weighted_tokens: String(input.weightedTokens),
      usage_estimated: input.usageEstimated,
      latency_ms: input.latencyMs,
      upstream_status: input.upstreamStatus,
    })
    .returning("*");
  return row!;
}

export interface UsageEventWithTime {
  created_at: Date;
  weighted_tokens: string;
}

/** Returns the user's usage events inside a rolling window, oldest first. */
export async function getUserWindowEvents(
  userId: string,
  windowSeconds: number,
): Promise<UsageEventWithTime[]> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  return db("usage_events")
    .where({ user_id: userId })
    .where("created_at", ">=", since)
    .orderBy("created_at", "asc")
    .select<UsageEventWithTime[]>("created_at", "weighted_tokens");
}

/**
 * Bulk variant of the window sum: total weighted tokens per user inside a
 * rolling window. Used by the console user list to render quota bars without
 * one query per row.
 */
export async function sumWeightedTokensByUser(
  userIds: string[],
  windowSeconds: number,
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const since = new Date(Date.now() - windowSeconds * 1000);
  const rows = await db("usage_events")
    .whereIn("user_id", userIds)
    .where("created_at", ">=", since)
    .select<{ user_id: string; total: string | null }[]>("user_id")
    .sum("weighted_tokens as total")
    .groupBy("user_id");
  return new Map(rows.map((row) => [row.user_id, Number(row.total ?? 0)]));
}

export async function sumWeightedTokensSince(userId: string, since: Date): Promise<number> {
  const row = await db("usage_events")
    .where({ user_id: userId })
    .where("created_at", ">=", since)
    .sum<{ total: string | null }>("weighted_tokens as total")
    .first();
  return Number(row?.total ?? 0);
}

export interface ListUsageFilter {
  userId?: string;
  modelId?: string;
  source?: UsageSource;
  status?: UsageStatus;
  from?: Date;
  to?: Date;
}

function applyUsageFilter<T extends Knex.QueryBuilder>(query: T, filter: ListUsageFilter): T {
  if (filter.userId) query.where("user_id", filter.userId);
  if (filter.modelId) query.where("model_id", filter.modelId);
  if (filter.source) query.where("source", filter.source);
  if (filter.status) query.where("status", filter.status);
  if (filter.from) query.where("created_at", ">=", filter.from);
  if (filter.to) query.where("created_at", "<=", filter.to);
  return query;
}

export async function listUsageEvents(
  filter: ListUsageFilter,
  pagination: { offset: number; limit: number },
): Promise<{ rows: UsageEventRow[]; total: number }> {
  const base = applyUsageFilter(db<UsageEventRow>("usage_events"), filter);
  const countRow = await base.clone().clearSelect().count<{ count: string }>("* as count").first();
  const rows = await base
    .clone()
    .select("*")
    .orderBy("created_at", "desc")
    .limit(pagination.limit)
    .offset(pagination.offset);
  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function listAllUsageEventsForExport(filter: ListUsageFilter, limit: number): Promise<UsageEventRow[]> {
  return applyUsageFilter(db<UsageEventRow>("usage_events"), filter)
    .select("*")
    .orderBy("created_at", "desc")
    .limit(limit);
}

export interface UsageByModelRow {
  model_public_name: string;
  prompt_tokens: string;
  completion_tokens: string;
  weighted_tokens: string;
  requests: string;
}

export async function usageByModel(
  filter: ListUsageFilter,
  limit = 10,
): Promise<UsageByModelRow[]> {
  const rows = await applyUsageFilter(db("usage_events"), filter)
    .select("model_public_name")
    .sum("prompt_tokens as prompt_tokens")
    .sum("completion_tokens as completion_tokens")
    .sum("weighted_tokens as weighted_tokens")
    .count("id as requests")
    .groupBy("model_public_name")
    .orderBy("weighted_tokens", "desc")
    .limit(limit);
  return rows as unknown as UsageByModelRow[];
}

export interface UsageByUserRow {
  user_id: string;
  weighted_tokens: string;
  requests: string;
}

export async function usageByUser(filter: ListUsageFilter, limit = 10): Promise<UsageByUserRow[]> {
  const rows = await applyUsageFilter(db("usage_events"), filter)
    .select("user_id")
    .sum("weighted_tokens as weighted_tokens")
    .count("id as requests")
    .groupBy("user_id")
    .orderBy("weighted_tokens", "desc")
    .limit(limit);
  return rows as unknown as UsageByUserRow[];
}

export interface TotalsRow {
  weighted_tokens: string | null;
  prompt_tokens: string | null;
  completion_tokens: string | null;
  requests: string;
  errors: string;
  cached_tokens: string | null;
  avg_latency_ms: string | null;
  success_2xx: string;
  client_4xx: string;
  server_5xx: string;
}

export async function usageTotals(filter: ListUsageFilter): Promise<TotalsRow> {
  const row = await applyUsageFilter(db("usage_events"), filter)
    .select(db.raw("coalesce(sum(weighted_tokens),0) as weighted_tokens"))
    .select(db.raw("coalesce(sum(prompt_tokens),0) as prompt_tokens"))
    .select(db.raw("coalesce(sum(completion_tokens),0) as completion_tokens"))
    .select(db.raw("coalesce(sum(cached_tokens),0) as cached_tokens"))
    .select(db.raw("count(*) as requests"))
    .select(db.raw("count(*) filter (where status <> 'success') as errors"))
    .select(db.raw("coalesce(avg(latency_ms),0) as avg_latency_ms"))
    .select(db.raw("count(*) filter (where upstream_status between 200 and 299) as success_2xx"))
    .select(db.raw("count(*) filter (where upstream_status between 400 and 499) as client_4xx"))
    .select(db.raw("count(*) filter (where upstream_status >= 500) as server_5xx"))
    .first<TotalsRow>();
  return (
    row ?? {
      weighted_tokens: "0",
      prompt_tokens: "0",
      completion_tokens: "0",
      requests: "0",
      errors: "0",
      cached_tokens: "0",
      avg_latency_ms: "0",
      success_2xx: "0",
      client_4xx: "0",
      server_5xx: "0",
    }
  );
}

export interface StatusCodeRow {
  upstream_status: number | null;
  requests: string;
}

/** Request counts per upstream HTTP status code (null = never reached upstream). */
export async function usageByStatusCode(filter: ListUsageFilter): Promise<StatusCodeRow[]> {
  return applyUsageFilter(db("usage_events"), filter)
    .select("upstream_status")
    .count("id as requests")
    .groupBy("upstream_status")
    .orderByRaw("upstream_status asc nulls last") as unknown as StatusCodeRow[];
}

export interface HourlyUsageRow {
  hour: string;
  requests: string;
  weighted_tokens: string;
  prompt_tokens: string;
  completion_tokens: string;
  cached_tokens: string;
}

/** Hourly buckets for the real-time traffic chart. */
export async function usageHourly(filter: ListUsageFilter): Promise<HourlyUsageRow[]> {
  return applyUsageFilter(db("usage_events"), filter)
    .select(db.raw("to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') as hour"))
    .sum("weighted_tokens as weighted_tokens")
    .count("id as requests")
    .select(db.raw("coalesce(sum(prompt_tokens),0) as prompt_tokens"))
    .select(db.raw("coalesce(sum(completion_tokens),0) as completion_tokens"))
    .select(db.raw("coalesce(sum(cached_tokens),0) as cached_tokens"))
    .groupByRaw("date_trunc('hour', created_at)")
    .orderByRaw("date_trunc('hour', created_at) asc") as unknown as HourlyUsageRow[];
}

export interface ProviderUsageRow {
  provider: string;
  requests: string;
  weighted_tokens: string;
  avg_latency_ms: string | null;
}

/**
 * Traffic per upstream provider. The provider is the first path segment of the
 * model public name (e.g. `groq/openai/gpt-oss-120b` -> `groq`).
 */
export async function usageByProvider(filter: ListUsageFilter): Promise<ProviderUsageRow[]> {
  return applyUsageFilter(db("usage_events"), filter)
    .select(db.raw("split_part(model_public_name, '/', 1) as provider"))
    .sum("weighted_tokens as weighted_tokens")
    .count("id as requests")
    .select(db.raw("coalesce(avg(latency_ms),0) as avg_latency_ms"))
    .groupByRaw("split_part(model_public_name, '/', 1)")
    .orderByRaw("count(id) desc") as unknown as ProviderUsageRow[];
}

export interface DailyUsageRow {
  day: string;
  weighted_tokens: string;
  requests: string;
  prompt_tokens: string;
  completion_tokens: string;
  cached_tokens: string;
}

export async function usageDaily(filter: ListUsageFilter): Promise<DailyUsageRow[]> {
  return applyUsageFilter(db("usage_events"), filter)
    .select(db.raw("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day"))
    .sum("weighted_tokens as weighted_tokens")
    .count("id as requests")
    .select(db.raw("coalesce(sum(prompt_tokens),0) as prompt_tokens"))
    .select(db.raw("coalesce(sum(completion_tokens),0) as completion_tokens"))
    .select(db.raw("coalesce(sum(cached_tokens),0) as cached_tokens"))
    .groupByRaw("date_trunc('day', created_at)")
    .orderByRaw("date_trunc('day', created_at) asc") as unknown as DailyUsageRow[];
}

export interface LatencyRow {
  p50: number | null;
  p95: number | null;
}

/** Overall latency percentiles for the filtered range (PRD F-11). */
export async function latencyPercentiles(filter: ListUsageFilter): Promise<LatencyRow> {
  const row = await applyUsageFilter(db("usage_events"), filter)
    .whereNotNull("latency_ms")
    .select(
      db.raw("percentile_cont(0.5) within group (order by latency_ms) as p50"),
      db.raw("percentile_cont(0.95) within group (order by latency_ms) as p95"),
    )
    .first<LatencyRow>();
  return { p50: row?.p50 ?? null, p95: row?.p95 ?? null };
}

/**
 * Latency percentiles grouped by the model public name snapshot on each event,
 * so the admin usage view can show p50/p95 per model.
 */
export interface ModelLatencyRow extends LatencyRow {
  model_public_name: string;
}

export async function latencyByModelName(filter: ListUsageFilter): Promise<ModelLatencyRow[]> {
  const rows = await applyUsageFilter(db("usage_events"), filter)
    .whereNotNull("latency_ms")
    .select("model_public_name")
    .select(db.raw("percentile_cont(0.5) within group (order by latency_ms) as p50"))
    .select(db.raw("percentile_cont(0.95) within group (order by latency_ms) as p95"))
    .groupBy("model_public_name");
  return rows as unknown as ModelLatencyRow[];
}

export async function deleteUsageOlderThan(date: Date): Promise<number> {
  return db("usage_events").where("created_at", "<", date).del();
}
