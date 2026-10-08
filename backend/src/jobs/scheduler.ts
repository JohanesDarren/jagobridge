import { logger } from "../core/logger.js";
import { loadEnv } from "../core/env.js";
import { getAllSettings } from "../repositories/settings.repository.js";
import { SETTING_KEYS } from "../services/settings.service.js";
import { syncModels } from "../services/model-sync.service.js";

const env = loadEnv();

let timer: NodeJS.Timeout | null = null;
let running = false;

async function resolveIntervalMs(): Promise<number> {
  const settings = await getAllSettings().catch(() => ({}) as Record<string, unknown>);
  const minutes =
    typeof settings[SETTING_KEYS.modelSyncIntervalMinutes] === "number"
      ? (settings[SETTING_KEYS.modelSyncIntervalMinutes] as number)
      : env.MODEL_SYNC_INTERVAL_MINUTES;
  return minutes * 60 * 1000;
}

async function runSync(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await syncModels(null, { ip: null, userAgent: "scheduler" });
    logger.info(result, "scheduled_model_sync_completed");
  } catch (error) {
    logger.error({ err: error }, "scheduled_model_sync_failed");
  } finally {
    running = false;
  }
}

/** Starts the model sync loop (re-reads the interval each cycle, PRD F-05/F-12). */
export function startScheduler(): void {
  if (timer) return;
  const tick = async () => {
    await runSync();
    const interval = await resolveIntervalMs();
    timer = setTimeout(tick, interval);
  };
  // First run shortly after boot.
  timer = setTimeout(tick, 15_000);
  logger.info("model_sync_scheduler_started");
}

export function stopScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
