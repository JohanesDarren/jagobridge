import { db } from "../db/knex.js";

export interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface AuditEntryInput {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function insertAuditLog(input: AuditEntryInput): Promise<void> {
  await db("audit_logs").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    before_state: input.beforeState ? JSON.stringify(input.beforeState) : null,
    after_state: input.afterState ? JSON.stringify(input.afterState) : null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ? input.userAgent.slice(0, 255) : null,
  });
}

export interface ListAuditFilter {
  actorUserId?: string;
  action?: string;
  targetType?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(
  filter: ListAuditFilter,
  pagination: { offset: number; limit: number },
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const base = db<AuditLogRow>("audit_logs");
  if (filter.actorUserId) base.where("actor_user_id", filter.actorUserId);
  if (filter.action) base.where("action", "like", `${filter.action}%`);
  if (filter.targetType) base.where("target_type", filter.targetType);
  if (filter.from) base.where("created_at", ">=", filter.from);
  if (filter.to) base.where("created_at", "<=", filter.to);

  const countRow = await base.clone().clearSelect().count<{ count: string }>("* as count").first();
  const rows = await base
    .clone()
    .select("*")
    .orderBy("created_at", "desc")
    .limit(pagination.limit)
    .offset(pagination.offset);
  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function deleteAuditOlderThan(date: Date): Promise<number> {
  return db("audit_logs").where("created_at", "<", date).del();
}
