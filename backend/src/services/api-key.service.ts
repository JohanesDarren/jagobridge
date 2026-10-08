import { AppError } from "../core/errors.js";
import { API_KEY_MAX_EXPIRY_DAYS, MAX_ACTIVE_API_KEYS_PER_USER } from "../core/constants.js";
import { generateApiKey } from "../core/security.js";
import {
  countActiveKeys,
  createApiKey,
  findApiKeyById,
  listApiKeysByUser,
  revokeApiKey,
  type ApiKeyRow,
} from "../repositories/api-key.repository.js";
import { recordAudit } from "./audit.service.js";
import type { RequestMeta } from "./auth.service.js";

export interface ApiKeyDto {
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

export function toApiKeyDto(row: ApiKeyRow): ApiKeyDto {
  const expired = row.expires_at !== null && row.expires_at.getTime() <= Date.now();
  const status: ApiKeyDto["status"] = row.revoked_at ? "revoked" : expired ? "expired" : "active";
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    key_prefix: row.key_prefix,
    last_used_at: row.last_used_at ? row.last_used_at.toISOString() : null,
    expires_at: row.expires_at ? row.expires_at.toISOString() : null,
    revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
    status,
    created_at: row.created_at.toISOString(),
  };
}

export async function listApiKeys(targetUserId: string): Promise<ApiKeyDto[]> {
  const rows = await listApiKeysByUser(targetUserId);
  return rows.map(toApiKeyDto);
}

export async function createApiKeyService(
  userId: string,
  name: string,
  expiresAtIso: string | null,
  meta: RequestMeta,
): Promise<ApiKeyDto & { key: string }> {
  const activeCount = await countActiveKeys(userId);
  if (activeCount >= MAX_ACTIVE_API_KEYS_PER_USER) {
    throw new AppError(
      422,
      "API_KEY_LIMIT_REACHED",
      `Maximum of ${MAX_ACTIVE_API_KEYS_PER_USER} active API keys reached`,
    );
  }

  let expiresAt: Date | null = null;
  if (expiresAtIso) {
    const parsed = new Date(expiresAtIso);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid expiry date", {
        expires_at: ["Must be a valid ISO 8601 date"],
      });
    }
    const maxExpiry = new Date(Date.now() + API_KEY_MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    if (parsed.getTime() > maxExpiry.getTime()) {
      throw new AppError(400, "VALIDATION_ERROR", "Expiry cannot be more than 1 year from now", {
        expires_at: ["Maximum 1 year from now"],
      });
    }
    expiresAt = parsed;
  }

  const generated = generateApiKey();
  const row = await createApiKey({
    userId,
    name,
    keyPrefix: generated.keyPrefix,
    keyHash: generated.keyHash,
    expiresAt,
  });

  await recordAudit({
    actorUserId: userId,
    action: "api_key.create",
    targetType: "api_key",
    targetId: row.id,
    afterState: { name: row.name, key_prefix: row.key_prefix },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return { ...toApiKeyDto(row), key: generated.fullKey };
}

export async function revokeApiKeyService(
  id: string,
  requesterId: string,
  isAdmin: boolean,
  meta: RequestMeta,
): Promise<void> {
  const row = await findApiKeyById(id);
  if (!row) throw new AppError(404, "NOT_FOUND", "API key not found");
  if (row.user_id !== requesterId && !isAdmin) {
    throw new AppError(403, "FORBIDDEN", "You cannot revoke this API key");
  }
  if (row.revoked_at) return;

  await revokeApiKey(id, requesterId);
  await recordAudit({
    actorUserId: requesterId,
    action: "api_key.revoke",
    targetType: "api_key",
    targetId: id,
    beforeState: { name: row.name, key_prefix: row.key_prefix },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
}
