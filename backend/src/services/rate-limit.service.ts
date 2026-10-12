import { RPM_WINDOW_SECONDS } from "../core/constants.js";

/**
 * In-process rate limiting (PRD F-08).
 *
 * RPM uses a sliding 60-second window per user; concurrency caps the number of
 * in-flight requests per user. Both are held in process memory.
 *
 * NOTE: this is per-instance state. It is correct for the single-instance
 * deployment in PRD §2.3. If JagoBridge is ever scaled to multiple instances,
 * these counters must move to a shared store (e.g. Redis) or each instance will
 * enforce its own copy of the limit.
 */

// ---------------------------------------------------------------------------
// Sliding-window RPM
// ---------------------------------------------------------------------------

/** userId -> ascending list of request timestamps (ms) inside the current window. */
const rpmHits = new Map<string, number[]>();

export interface RpmCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (seconds) when the current minute window resets. */
  resetAt: number;
}

/**
 * Sliding 60-second window per user (PRD F-08).
 * A limit of 0 means unlimited.
 */
export async function checkRpm(userId: string, limit: number): Promise<RpmCheckResult> {
  const now = Date.now();
  const windowStart = now - RPM_WINDOW_SECONDS * 1000;
  const resetAt = Math.ceil((now + RPM_WINDOW_SECONDS * 1000) / 1000);

  if (limit <= 0) {
    return { allowed: true, limit: -1, remaining: -1, resetAt };
  }

  const hits = (rpmHits.get(userId) ?? []).filter((at) => at > windowStart);
  hits.push(now);

  const count = hits.length;
  const allowed = count <= limit;

  if (allowed) {
    rpmHits.set(userId, hits);
  } else {
    // Rejected calls must not extend the window: store the pruned list without
    // the entry we just appended.
    hits.pop();
    rpmHits.set(userId, hits);
  }

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

// ---------------------------------------------------------------------------
// In-flight concurrency
// ---------------------------------------------------------------------------

/** userId -> number of requests currently in flight. */
const inflightCounts = new Map<string, number>();

export interface ConcurrencyHandle {
  acquired: boolean;
  release: () => Promise<void>;
}

/**
 * Caps the number of in-flight requests per user (PRD F-08).
 * A limit of 0 means unlimited.
 */
export async function acquireConcurrency(userId: string, limit: number): Promise<ConcurrencyHandle> {
  if (limit <= 0) {
    return { acquired: true, release: async () => undefined };
  }

  const current = inflightCounts.get(userId) ?? 0;
  if (current >= limit) {
    return { acquired: false, release: async () => undefined };
  }

  inflightCounts.set(userId, current + 1);

  let released = false;
  return {
    acquired: true,
    release: async () => {
      if (released) return;
      released = true;
      const remaining = (inflightCounts.get(userId) ?? 1) - 1;
      if (remaining <= 0) inflightCounts.delete(userId);
      else inflightCounts.set(userId, remaining);
    },
  };
}

export async function getInflightCount(userId: string): Promise<number> {
  return inflightCounts.get(userId) ?? 0;
}

// ---------------------------------------------------------------------------
// Housekeeping — drop idle entries so memory cannot grow without bound
// ---------------------------------------------------------------------------

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const sweep = setInterval(() => {
  const windowStart = Date.now() - RPM_WINDOW_SECONDS * 1000;
  for (const [userId, hits] of rpmHits) {
    const live = hits.filter((at) => at > windowStart);
    if (live.length === 0) rpmHits.delete(userId);
    else rpmHits.set(userId, live);
  }
  for (const [userId, count] of inflightCounts) {
    if (count <= 0) inflightCounts.delete(userId);
  }
}, SWEEP_INTERVAL_MS);

// Do not keep the process alive just for housekeeping.
sweep.unref?.();

/** Test helper: clears all in-process rate-limit state. */
export function resetRateLimitState(): void {
  rpmHits.clear();
  inflightCounts.clear();
}
