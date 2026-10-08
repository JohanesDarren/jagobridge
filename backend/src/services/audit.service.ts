import { insertAuditLog, type AuditEntryInput } from "../repositories/audit.repository.js";
import { logger } from "../core/logger.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "new_password",
  "temporary_password",
  "token",
  "token_hash",
  "refresh_token",
  "access_token",
  "api_key",
  "key",
  "key_hash",
  "secret",
  "upstream_api_key",
]);

/** Masks sensitive fields before they are written to the append-only audit log. */
export function maskState(state: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!state) return null;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (SENSITIVE_KEYS.has(key)) {
      masked[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      masked[key] = maskState(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/** Writes an audit entry. Failures are logged but never break the request. */
export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  try {
    await insertAuditLog({
      ...entry,
      beforeState: maskState(entry.beforeState),
      afterState: maskState(entry.afterState),
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, "audit_write_failed");
  }
}
