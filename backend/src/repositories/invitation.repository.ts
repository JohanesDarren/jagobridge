import type { Knex } from "knex";
import { db } from "../db/knex.js";
import type { Role } from "../core/constants.js";

export interface InvitationRow {
  id: string;
  email: string;
  role: Role;
  access_profile_id: string;
  token_hash: string;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  created_by: string;
}

export async function createInvitation(
  input: {
    email: string;
    role: Role;
    accessProfileId: string;
    tokenHash: string;
    expiresAt: Date;
    createdBy: string;
  },
  trx: Knex = db,
): Promise<InvitationRow> {
  const [row] = await trx<InvitationRow>("user_invitations")
    .insert({
      email: input.email,
      role: input.role,
      access_profile_id: input.accessProfileId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      created_by: input.createdBy,
    })
    .returning("*");
  return row!;
}

export async function findInvitationById(id: string): Promise<InvitationRow | undefined> {
  return db<InvitationRow>("user_invitations").where({ id }).first();
}

export async function findByTokenHash(tokenHash: string): Promise<InvitationRow | undefined> {
  return db<InvitationRow>("user_invitations").where({ token_hash: tokenHash }).first();
}

export async function findPendingByEmail(email: string): Promise<InvitationRow | undefined> {
  return db<InvitationRow>("user_invitations")
    .whereRaw("lower(email) = lower(?)", [email])
    .whereNull("accepted_at")
    .whereNull("revoked_at")
    .where("expires_at", ">", db.fn.now())
    .first();
}

export async function listPendingInvitations(): Promise<InvitationRow[]> {
  return db<InvitationRow>("user_invitations")
    .whereNull("accepted_at")
    .whereNull("revoked_at")
    .orderBy("created_at", "desc");
}

export async function markAccepted(id: string, trx: Knex = db): Promise<void> {
  await trx("user_invitations").where({ id }).update({ accepted_at: trx.fn.now() });
}

export async function revokeInvitation(id: string, trx: Knex = db): Promise<void> {
  await trx("user_invitations").where({ id }).whereNull("revoked_at").update({ revoked_at: trx.fn.now() });
}

export async function revokeAllForEmail(email: string, trx: Knex = db): Promise<void> {
  await trx("user_invitations")
    .whereRaw("lower(email) = lower(?)", [email])
    .whereNull("accepted_at")
    .whereNull("revoked_at")
    .update({ revoked_at: trx.fn.now() });
}

export async function deleteExpiredInvitationsBefore(date: Date): Promise<number> {
  return db("user_invitations").where("expires_at", "<", date).del();
}
