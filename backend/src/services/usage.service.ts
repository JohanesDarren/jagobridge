import type { UsageSource, UsageStatus } from "../core/constants.js";
import {
  CHARS_PER_ESTIMATED_TOKEN,
  FIVE_HOUR_WINDOW_SECONDS,
  QUOTA_EXCEEDED_THRESHOLD,
  QUOTA_WARNING_THRESHOLD,
  WEEKLY_WINDOW_SECONDS,
} from "../core/constants.js";
import {
  getUserWindowEvents,
  insertUsageEvent,
  type UsageEventWithTime,
} from "../repositories/usage.repository.js";
import type { EffectiveLimits } from "./access.service.js";

export type WindowState = "unlimited" | "ok" | "warning" | "exceeded";

export interface WindowUsage {
  usedTokens: number;
  limitTokens: number;
  remainingTokens: number;
  resetAt: Date | null;
  state: WindowState;
}

/**
 * weighted_tokens = ROUND((prompt_tokens + completion_tokens) x token_multiplier)
 * (PRD F-08).
 */
export function weighTokens(input: { prompt: number; completion: number; multiplier: number }): number {
  return Math.round((input.prompt + input.completion) * input.multiplier);
}

/** Fallback estimate: ceil(characters / 4). */
export function estimateTokens(characters: number): number {
  return Math.ceil(characters / CHARS_PER_ESTIMATED_TOKEN);
}

export function computeWindowState(usedTokens: number, limitTokens: number): WindowState {
  if (limitTokens <= 0) return "unlimited";
  const ratio = usedTokens / limitTokens;
  if (ratio >= QUOTA_EXCEEDED_THRESHOLD) return "exceeded";
  if (ratio >= QUOTA_WARNING_THRESHOLD) return "warning";
  return "ok";
}

/**
 * Reset time: walk the window's events oldest first, removing them one by one
 * until remaining usage is below the limit. The time the last removed event
 * leaves the window is the reset time (PRD F-08 "Retry-After rule").
 */
export function computeResetAt(
  events: Array<{ at: Date; tokens: number }>,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): Date | null {
  if (limit <= 0) return null;
  const total = events.reduce((sum, event) => sum + event.tokens, 0);
  if (total < limit) return null;

  const ordered = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  let remaining = total;
  for (const event of ordered) {
    remaining -= event.tokens;
    if (remaining < limit) {
      return new Date(event.at.getTime() + windowSeconds * 1000);
    }
  }
  return new Date(now.getTime() + windowSeconds * 1000);
}

export function buildWindowUsage(
  usedTokens: number,
  limitTokens: number,
  events: Array<{ at: Date; tokens: number }>,
  windowSeconds: number,
): WindowUsage {
  const state = computeWindowState(usedTokens, limitTokens);
  if (state === "unlimited") {
    return {
      usedTokens,
      limitTokens: -1,
      remainingTokens: -1,
      resetAt: null,
      state,
    };
  }
  return {
    usedTokens,
    limitTokens,
    remainingTokens: Math.max(0, limitTokens - usedTokens),
    resetAt: computeResetAt(events, limitTokens, windowSeconds),
    state,
  };
}

export interface QuotaSnapshot {
  fiveHour: WindowUsage;
  weekly: WindowUsage;
  rpmLimit: number;
}

/** Reads both rolling windows for a user and computes quota state. */
export async function getQuotaSnapshot(
  userId: string,
  limits: EffectiveLimits,
): Promise<QuotaSnapshot> {
  const [fiveHourEvents, weeklyEvents] = await Promise.all([
    getUserWindowEvents(userId, FIVE_HOUR_WINDOW_SECONDS),
    getUserWindowEvents(userId, WEEKLY_WINDOW_SECONDS),
  ]);

  const toPlain = (rows: UsageEventWithTime[]) =>
    rows.map((row) => ({ at: new Date(row.created_at), tokens: Number(row.weighted_tokens) }));

  const fiveHourPlains = toPlain(fiveHourEvents);
  const weeklyPlains = toPlain(weeklyEvents);
  const fiveHourUsed = fiveHourPlains.reduce((sum, event) => sum + event.tokens, 0);
  const weeklyUsed = weeklyPlains.reduce((sum, event) => sum + event.tokens, 0);

  return {
    fiveHour: buildWindowUsage(fiveHourUsed, limits.limit5hTokens, fiveHourPlains, FIVE_HOUR_WINDOW_SECONDS),
    weekly: buildWindowUsage(weeklyUsed, limits.limitWeeklyTokens, weeklyPlains, WEEKLY_WINDOW_SECONDS),
    rpmLimit: limits.limitRpm,
  };
}

export type AdmissionWindow = "five_hour" | "weekly";

export interface AdmissionResult {
  admitted: boolean;
  window?: AdmissionWindow;
  retryAfterSeconds?: number;
  snapshot: QuotaSnapshot;
}

/**
 * Admission rule: reject before forwarding if usage in either window is at or
 * above the limit. A request admitted under the limit runs to completion
 * (Decision D-02).
 */
export async function checkAdmission(
  userId: string,
  limits: EffectiveLimits,
): Promise<AdmissionResult> {
  const snapshot = await getQuotaSnapshot(userId, limits);

  // Package "Overage: allow" keeps serving after the window is exhausted.
  if (limits.overageAction === "allow") {
    return { admitted: true, snapshot };
  }

  const evaluate = (window: WindowUsage): { blocked: boolean; retryAfter?: number } => {
    if (window.state === "unlimited") return { blocked: false };
    if (window.usedTokens >= window.limitTokens) {
      const seconds = window.resetAt
        ? Math.max(1, Math.ceil((window.resetAt.getTime() - Date.now()) / 1000))
        : FIVE_HOUR_WINDOW_SECONDS;
      return { blocked: true, retryAfter: seconds };
    }
    return { blocked: false };
  };

  const fiveHour = evaluate(snapshot.fiveHour);
  if (fiveHour.blocked) {
    return { admitted: false, window: "five_hour", retryAfterSeconds: fiveHour.retryAfter, snapshot };
  }
  const weekly = evaluate(snapshot.weekly);
  if (weekly.blocked) {
    return { admitted: false, window: "weekly", retryAfterSeconds: weekly.retryAfter, snapshot };
  }
  return { admitted: true, snapshot };
}

export interface RecordUsageInput {
  requestId: string;
  userId: string;
  apiKeyId: string | null;
  modelId: string | null;
  modelPublicName: string;
  source: UsageSource;
  status: UsageStatus;
  promptTokens: number;
  completionTokens: number;
  /** Prompt tokens served from the upstream prompt cache. */
  cachedTokens: number;
  tokenMultiplier: number;
  usageEstimated: boolean;
  latencyMs: number | null;
  /** HTTP status from 9router; null when no upstream response was received. */
  upstreamStatus: number | null;
}

/** Records one usage event. Never blocks the response longer than necessary. */
export async function recordUsage(input: RecordUsageInput): Promise<{ id: string; weightedTokens: number }> {
  const weightedTokens = weighTokens({
    prompt: input.promptTokens,
    completion: input.completionTokens,
    multiplier: input.tokenMultiplier,
  });
  const row = await insertUsageEvent({
    ...input,
    weightedTokens,
  });
  return { id: row.id, weightedTokens };
}
