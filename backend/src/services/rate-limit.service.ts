import { redis } from "../db/redis.js";
import { RPM_WINDOW_SECONDS } from "../core/constants.js";

const rpmKey = (userId: string) => `rpm:${userId}`;
const inflightKey = (userId: string) => `inflight:${userId}`;
const INFLIGHT_SAFETY_TTL_SECONDS = 300;

export interface RpmCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (seconds) when the current minute window resets. */
  resetAt: number;
}

/**
 * Sliding 60-second window per user using a Redis sorted set (PRD F-08).
 * A limit of 0 means unlimited.
 */
export async function checkRpm(userId: string, limit: number): Promise<RpmCheckResult> {
  const now = Date.now();
  const windowStart = now - RPM_WINDOW_SECONDS * 1000;
  const resetAt = Math.ceil((now + RPM_WINDOW_SECONDS * 1000) / 1000);

  if (limit <= 0) {
    return { allowed: true, limit: -1, remaining: -1, resetAt };
  }

  const key = rpmKey(userId);
  const pipeline = redis.multi();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);
  pipeline.expire(key, RPM_WINDOW_SECONDS + 5);
  const results = await pipeline.exec();
  const count = Number(results?.[2]?.[1] ?? 0);

  const allowed = count <= limit;
  if (!allowed) {
    // Remove the just-added entry so rejected calls do not extend the window.
    await redis.zremrangebyscore(key, now, now);
  }

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

export interface ConcurrencyHandle {
  acquired: boolean;
  release: () => Promise<void>;
}

/**
 * Caps the number of in-flight requests per user using an atomic Redis counter
 * (PRD F-08). A limit of 0 means unlimited.
 */
export async function acquireConcurrency(userId: string, limit: number): Promise<ConcurrencyHandle> {
  if (limit <= 0) {
    return { acquired: true, release: async () => undefined };
  }
  const key = inflightKey(userId);
  const count = await redis.incr(key);
  await redis.expire(key, INFLIGHT_SAFETY_TTL_SECONDS);

  if (count > limit) {
    await redis.decr(key);
    return { acquired: false, release: async () => undefined };
  }

  let released = false;
  return {
    acquired: true,
    release: async () => {
      if (released) return;
      released = true;
      const remaining = await redis.decr(key);
      if (remaining <= 0) await redis.del(key);
    },
  };
}

export async function getInflightCount(userId: string): Promise<number> {
  return Number((await redis.get(inflightKey(userId))) ?? 0);
}
