import bcrypt from "bcryptjs";
import { loadEnv } from "../core/env.js";
import { AppError } from "../core/errors.js";
import {
  accessTokenExpiresInSeconds,
  generateOpaqueToken,
  hashPassword,
  refreshTokenExpiresAt,
  sha256Hex,
  signAccessToken,
  validatePasswordComplexity,
  verifyPassword,
} from "../core/security.js";
import {
  createRefreshToken,
  findByTokenHash,
  revokeAllForUser,
  revokeToken,
} from "../repositories/refresh-token.repository.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  type UserRow,
} from "../repositories/user.repository.js";
import { findByTokenHash as findInvitationByHash, markAccepted as markInvitationAccepted } from "../repositories/invitation.repository.js";
import { findProfileById } from "../repositories/access-profile.repository.js";
import { recordAudit } from "./audit.service.js";
import { sendLockoutEmail } from "./email.service.js";
import { db } from "../db/knex.js";
import { invalidateAccessCache } from "./access.service.js";

const env = loadEnv();

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: UserRow;
  tokens: AuthTokens;
}

async function issueTokens(
  user: UserRow,
  meta: RequestMeta,
  trx = db,
): Promise<AuthTokens> {
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = generateOpaqueToken(48);
  await createRefreshToken(
    {
      userId: user.id,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: refreshTokenExpiresAt(),
      userAgent: meta.userAgent,
    },
    trx,
  );
  return { accessToken, refreshToken, expiresIn: accessTokenExpiresInSeconds() };
}

/** Constant-time-ish dummy compare so unknown emails do not leak via timing. */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-value", 10);

export async function login(email: string, password: string, meta: RequestMeta): Promise<LoginResult> {
  const user = await findUserByEmail(email);

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.locked_until && user.locked_until.getTime() > Date.now()) {
    throw new AppError(423, "ACCOUNT_LOCKED", "Account locked due to too many failed sign-in attempts");
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const nextCount = user.failed_login_count + 1;
    if (nextCount >= env.LOGIN_MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60 * 1000);
      await updateUser(user.id, { failed_login_count: nextCount, locked_until: lockedUntil });
      await sendLockoutEmail(user.email, env.LOGIN_LOCK_MINUTES);
      await recordAudit({
        actorUserId: user.id,
        action: "auth.lockout",
        targetType: "user",
        targetId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new AppError(423, "ACCOUNT_LOCKED", "Account locked due to too many failed sign-in attempts");
    }
    await updateUser(user.id, { failed_login_count: nextCount });
    await recordAudit({
      actorUserId: user.id,
      action: "auth.login_failed",
      targetType: "user",
      targetId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (!user.is_active) {
    throw new AppError(403, "ACCOUNT_INACTIVE", "Account is deactivated");
  }

  const updated = await updateUser(user.id, {
    failed_login_count: 0,
    locked_until: null,
    last_login_at: new Date(),
  });

  const tokens = await issueTokens(updated ?? user, meta);
  await recordAudit({
    actorUserId: user.id,
    action: "auth.login_success",
    targetType: "user",
    targetId: user.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { user: updated ?? user, tokens };
}

export async function refresh(refreshToken: string, meta: RequestMeta): Promise<LoginResult> {
  const tokenHash = sha256Hex(refreshToken);
  const stored = await findByTokenHash(tokenHash);

  if (!stored) {
    throw new AppError(401, "REFRESH_TOKEN_INVALID", "Refresh token not found");
  }

  if (stored.revoked_at) {
    // Reuse of an already-rotated token: revoke every session for that user.
    await revokeAllForUser(stored.user_id, "reuse");
    await recordAudit({
      actorUserId: stored.user_id,
      action: "auth.refresh_reuse_detected",
      targetType: "user",
      targetId: stored.user_id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new AppError(401, "REFRESH_TOKEN_REVOKED", "Refresh token already used or revoked");
  }

  if (stored.expires_at.getTime() <= Date.now()) {
    throw new AppError(401, "REFRESH_TOKEN_EXPIRED", "Refresh token expired");
  }

  const user = await findUserById(stored.user_id);
  if (!user || !user.is_active) {
    throw new AppError(403, "ACCOUNT_INACTIVE", "Account is deactivated");
  }

  const tokens = await db.transaction(async (trx) => {
    await revokeToken(stored.id, "rotated", trx);
    return issueTokens(user, meta, trx);
  });

  return { user, tokens };
}

export async function logout(refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
  if (!refreshToken) return;
  const stored = await findByTokenHash(sha256Hex(refreshToken));
  if (stored && !stored.revoked_at) {
    await revokeToken(stored.id, "logout");
  }
  await recordAudit({
    actorUserId: stored?.user_id ?? null,
    action: "auth.logout",
    targetType: "user",
    targetId: stored?.user_id ?? null,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<void> {
  const user = await findUserById(userId);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    throw new AppError(400, "VALIDATION_ERROR", "Current password is incorrect", {
      current_password: ["Current password is incorrect"],
    });
  }

  const check = validatePasswordComplexity(newPassword);
  if (!check.valid) {
    throw new AppError(400, "VALIDATION_ERROR", "Password does not meet the requirements", {
      new_password: check.errors,
    });
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUser(userId, { password_hash: passwordHash, must_change_password: false });
  await revokeAllForUser(userId, "admin");
  await recordAudit({
    actorUserId: userId,
    action: "auth.password_changed",
    targetType: "user",
    targetId: userId,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function acceptInvite(
  token: string,
  name: string,
  password: string,
  meta: RequestMeta,
): Promise<LoginResult> {
  const invitation = await findInvitationByHash(sha256Hex(token));
  if (
    !invitation ||
    invitation.revoked_at !== null ||
    invitation.accepted_at !== null ||
    invitation.expires_at.getTime() <= Date.now()
  ) {
    throw new AppError(400, "INVITATION_INVALID", "This invitation is no longer valid");
  }

  const check = validatePasswordComplexity(password);
  if (!check.valid) {
    throw new AppError(400, "VALIDATION_ERROR", "Password does not meet the requirements", {
      password: check.errors,
    });
  }

  const profile = await findProfileById(invitation.access_profile_id);
  if (!profile) {
    throw new AppError(400, "INVITATION_INVALID", "This invitation is no longer valid");
  }

  const passwordHash = await hashPassword(password);

  const user = await db.transaction(async (trx) => {
    const created = await createUser(
      {
        name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        accessProfileId: invitation.access_profile_id,
        mustChangePassword: false,
      },
      trx,
    );
    await markInvitationAccepted(invitation.id, trx);
    return created;
  });

  await invalidateAccessCache(user.id);
  const tokens = await issueTokens(user, meta);
  await recordAudit({
    actorUserId: user.id,
    action: "invitation.accepted",
    targetType: "user",
    targetId: user.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { user, tokens };
}

export function buildInviteUrl(token: string): string {
  return `${env.FRONTEND_BASE_URL.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;
}
