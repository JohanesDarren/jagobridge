import { loadEnv } from "../core/env.js";
import { logger } from "../core/logger.js";
import { deleteUsageOlderThan } from "../repositories/usage.repository.js";
import { deleteAuditOlderThan } from "../repositories/audit.repository.js";
import { deleteExpiredInvitationsBefore, deleteExpiredRefreshTokensBefore } from "../repositories/retention.repository.js";
import { purgeDeletedSessionsBefore, purgeInactiveSessionsBefore } from "../repositories/chat.repository.js";

const env = loadEnv();
const DAY_MS = 24 * 60 * 60 * 1000;
const DELETED_SESSION_GRACE_DAYS = 30;

/** Deletes data past its retention window (PRD §10.1). */
export async function runRetention(): Promise<Record<string, number>> {
  const now = Date.now();
  const results = {
    usage_events: await deleteUsageOlderThan(new Date(now - env.USAGE_RETENTION_DAYS * DAY_MS)),
    audit_logs: await deleteAuditOlderThan(new Date(now - env.AUDIT_RETENTION_DAYS * DAY_MS)),
    chat_sessions_purged: await purgeDeletedSessionsBefore(new Date(now - DELETED_SESSION_GRACE_DAYS * DAY_MS)),
    chat_sessions_expired: await purgeInactiveSessionsBefore(
      new Date(now - env.PLAYGROUND_RETENTION_DAYS * DAY_MS),
    ),
    refresh_tokens: await deleteExpiredRefreshTokensBefore(new Date(now - 30 * DAY_MS)),
    invitations: await deleteExpiredInvitationsBefore(new Date(now - 30 * DAY_MS)),
  };
  logger.info(results, "retention_completed");
  return results;
}

let retentionTimer: NodeJS.Timeout | null = null;

export function startRetentionJob(): void {
  if (retentionTimer) return;
  const schedule = async () => {
    await runRetention().catch((error) => logger.error({ err: error }, "retention_failed"));
    retentionTimer = setTimeout(schedule, DAY_MS);
  };
  retentionTimer = setTimeout(schedule, 60_000);
  logger.info("retention_job_started");
}

export function stopRetentionJob(): void {
  if (retentionTimer) {
    clearTimeout(retentionTimer);
    retentionTimer = null;
  }
}
