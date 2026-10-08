import { AppError } from "../core/errors.js";
import { loadEnv } from "../core/env.js";
import { generateOpaqueToken, invitationExpiresAt, sha256Hex } from "../core/security.js";
import type { Role } from "../core/constants.js";
import {
  createInvitation,
  findInvitationById,
  listPendingInvitations,
  revokeAllForEmail,
  revokeInvitation,
  type InvitationRow,
} from "../repositories/invitation.repository.js";
import { findUserByEmail } from "../repositories/user.repository.js";
import { findProfileById } from "../repositories/access-profile.repository.js";
import { recordAudit } from "./audit.service.js";
import { sendInvitationEmail } from "./email.service.js";
import { buildInviteUrl, type RequestMeta } from "./auth.service.js";

const env = loadEnv();

export interface InvitationDto {
  id: string;
  email: string;
  role: Role;
  access_profile_id: string;
  expires_at: string;
  created_at: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invite_url?: string;
}

export function toInvitationDto(row: InvitationRow): InvitationDto {
  const status: InvitationDto["status"] = row.accepted_at
    ? "accepted"
    : row.revoked_at
      ? "revoked"
      : row.expires_at.getTime() <= Date.now()
        ? "expired"
        : "pending";
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    access_profile_id: row.access_profile_id,
    expires_at: row.expires_at.toISOString(),
    created_at: row.created_at.toISOString(),
    status,
  };
}

export async function listPendingInvitationsDto(): Promise<InvitationDto[]> {
  const rows = await listPendingInvitations();
  return rows.map(toInvitationDto);
}

export async function inviteUser(
  input: { email: string; role: Role; accessProfileId: string },
  actorId: string,
  meta: RequestMeta,
): Promise<InvitationDto> {
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    throw new AppError(409, "EMAIL_EXISTS", "Email already belongs to an active user");
  }
  const profile = await findProfileById(input.accessProfileId);
  if (!profile) {
    throw new AppError(400, "VALIDATION_ERROR", "Access profile not found", {
      access_profile_id: ["Access profile not found"],
    });
  }

  const token = generateOpaqueToken();
  const row = await createInvitation({
    email: input.email,
    role: input.role,
    accessProfileId: input.accessProfileId,
    tokenHash: sha256Hex(token),
    expiresAt: invitationExpiresAt(),
    createdBy: actorId,
  });

  const inviteUrl = buildInviteUrl(token);
  await sendInvitationEmail(input.email, inviteUrl, env.INVITATION_EXPIRE_HOURS);

  await recordAudit({
    actorUserId: actorId,
    action: "invitation.create",
    targetType: "user_invitation",
    targetId: row.id,
    afterState: { email: row.email, role: row.role },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return { ...toInvitationDto(row), invite_url: inviteUrl };
}

export async function resendInvitation(
  id: string,
  actorId: string,
  meta: RequestMeta,
): Promise<InvitationDto> {
  const invitation = await findInvitationById(id);
  if (!invitation) throw new AppError(404, "NOT_FOUND", "Invitation not found");
  if (invitation.accepted_at) {
    throw new AppError(400, "INVITATION_INVALID", "Invitation was already accepted");
  }

  await revokeInvitation(id);
  const token = generateOpaqueToken();
  const row = await createInvitation({
    email: invitation.email,
    role: invitation.role,
    accessProfileId: invitation.access_profile_id,
    tokenHash: sha256Hex(token),
    expiresAt: invitationExpiresAt(),
    createdBy: actorId,
  });

  const inviteUrl = buildInviteUrl(token);
  await sendInvitationEmail(invitation.email, inviteUrl, env.INVITATION_EXPIRE_HOURS);

  await recordAudit({
    actorUserId: actorId,
    action: "invitation.resend",
    targetType: "user_invitation",
    targetId: row.id,
    afterState: { email: row.email },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return { ...toInvitationDto(row), invite_url: inviteUrl };
}

export async function revokeInvitationService(id: string, actorId: string, meta: RequestMeta): Promise<void> {
  const invitation = await findInvitationById(id);
  if (!invitation) throw new AppError(404, "NOT_FOUND", "Invitation not found");
  await revokeAllForEmail(invitation.email);
  await recordAudit({
    actorUserId: actorId,
    action: "invitation.revoke",
    targetType: "user_invitation",
    targetId: id,
    beforeState: { email: invitation.email },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
}
