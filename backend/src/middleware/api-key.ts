import type { NextFunction, Request, Response } from "express";
import { API_KEY_PREFIX } from "../core/constants.js";
import { gatewayError } from "../core/errors.js";
import { hashApiKey } from "../core/security.js";
import { findActiveKeyByHash, touchApiKeyLastUsed } from "../repositories/api-key.repository.js";
import { findUserById } from "../repositories/user.repository.js";

/**
 * Authenticates a gateway request with `Authorization: Bearer jb_...`
 * (PRD F-09 pipeline step 1). The raw key never leaves this middleware.
 */
export async function gatewayAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      throw gatewayError(401, "INVALID_API_KEY", "Missing API key. Use Authorization: Bearer jb_...");
    }
    const rawKey = header.slice(7).trim();
    if (!rawKey.startsWith(API_KEY_PREFIX)) {
      throw gatewayError(401, "INVALID_API_KEY", "Invalid API key");
    }

    const record = await findActiveKeyByHash(hashApiKey(rawKey));
    if (!record) {
      throw gatewayError(401, "INVALID_API_KEY", "Invalid, revoked, or expired API key");
    }
    if (record.expires_at && record.expires_at.getTime() <= Date.now()) {
      throw gatewayError(401, "INVALID_API_KEY", "API key expired");
    }

    const user = await findUserById(record.user_id);
    if (!user) {
      throw gatewayError(401, "INVALID_API_KEY", "Invalid API key");
    }
    if (!user.is_active) {
      throw gatewayError(403, "USER_INACTIVE", "Your account is deactivated");
    }

    req.gatewayKey = { id: record.id, userId: user.id, prefix: record.key_prefix };
    req.authUser = user;

    // Best-effort; must not delay the response path meaningfully.
    void touchApiKeyLastUsed(record.id).catch(() => undefined);
    next();
  } catch (error) {
    next(error);
  }
}
