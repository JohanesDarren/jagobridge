import { createApp } from "./app.js";
import { loadEnv } from "./core/env.js";
import { logger } from "./core/logger.js";
import { closeDatabase } from "./db/knex.js";
import { closeRedis } from "./db/redis.js";
import { startRetentionJob, stopRetentionJob } from "./jobs/retention.js";
import { startScheduler, stopScheduler } from "./jobs/scheduler.js";

const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.APP_ENV }, "jagobridge_started");
  startScheduler();
  startRetentionJob();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutdown_started");
  stopScheduler();
  stopRetentionJob();
  server.close(async () => {
    await closeDatabase().catch(() => undefined);
    await closeRedis().catch(() => undefined);
    logger.info("shutdown_complete");
    process.exit(0);
  });
  // Force exit if close hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled_rejection");
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught_exception");
  void shutdown("uncaughtException");
});
