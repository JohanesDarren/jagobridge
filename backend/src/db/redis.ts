import Redis from "ioredis";
import { loadEnv } from "../core/env.js";
import { logger } from "../core/logger.js";

const env = loadEnv();

const globalForRedis = globalThis as unknown as { __jagobridgeRedis?: Redis };

export const redis: Redis =
  globalForRedis.__jagobridgeRedis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

redis.on("error", (error: Error) => {
  logger.error({ err: error }, "redis_error");
});

if (env.APP_ENV !== "production") {
  globalForRedis.__jagobridgeRedis = redis;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
