import { db } from "../db/knex.js";

export async function deleteExpiredRefreshTokensBefore(date: Date): Promise<number> {
  return db("refresh_tokens").where("expires_at", "<", date).del();
}

export async function deleteExpiredInvitationsBefore(date: Date): Promise<number> {
  return db("user_invitations").where("expires_at", "<", date).del();
}
