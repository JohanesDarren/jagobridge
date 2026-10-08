import type { Knex } from "knex";
import { db } from "../db/knex.js";
import type { Role } from "../core/constants.js";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  access_profile_id: string | null;
  limit_5h_tokens_override: string | null;
  limit_weekly_tokens_override: string | null;
  limit_rpm_override: number | null;
  is_active: boolean;
  must_change_password: boolean;
  usage_notice_acknowledged: boolean;
  failed_login_count: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  accessProfileId: string | null;
  mustChangePassword?: boolean;
  createdBy?: string | null;
}

export interface ListUsersFilter {
  search?: string;
  status?: "active" | "inactive";
  role?: Role;
  profileId?: string;
}

export interface UserListResult {
  rows: UserRow[];
  total: number;
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  return db<UserRow>("users")
    .whereRaw("lower(email) = lower(?)", [email])
    .whereNull("deleted_at")
    .first();
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  return db<UserRow>("users").where({ id }).whereNull("deleted_at").first();
}

export async function findUserByIdIncludingDeleted(id: string): Promise<UserRow | undefined> {
  return db<UserRow>("users").where({ id }).first();
}

export async function createUser(input: CreateUserInput, trx: Knex = db): Promise<UserRow> {
  const [row] = await trx<UserRow>("users")
    .insert({
      name: input.name,
      email: input.email,
      password_hash: input.passwordHash,
      role: input.role,
      access_profile_id: input.accessProfileId,
      must_change_password: input.mustChangePassword ?? true,
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    })
    .returning("*");
  return row!;
}

export async function updateUser(
  id: string,
  patch: Partial<{
    name: string;
    email: string;
    password_hash: string;
    role: Role;
    access_profile_id: string | null;
    limit_5h_tokens_override: string | null;
    limit_weekly_tokens_override: string | null;
    limit_rpm_override: number | null;
    is_active: boolean;
    must_change_password: boolean;
    usage_notice_acknowledged: boolean;
    failed_login_count: number;
    locked_until: Date | null;
    last_login_at: Date | null;
    deleted_at: Date | null;
    updated_by: string | null;
    updated_at: Date;
  }>,
  trx: Knex = db,
): Promise<UserRow | undefined> {
  const [row] = await trx<UserRow>("users")
    .where({ id })
    .update({ ...patch, updated_at: trx.fn.now() })
    .returning("*");
  return row;
}

export async function listUsers(
  filter: ListUsersFilter,
  pagination: { offset: number; limit: number },
): Promise<UserListResult> {
  const base = db<UserRow>("users").whereNull("deleted_at");
  if (filter.search) {
    const term = `%${filter.search.toLowerCase()}%`;
    base.where((builder) =>
      builder.whereRaw("lower(name) like ?", [term]).orWhereRaw("lower(email) like ?", [term]),
    );
  }
  if (filter.status === "active") base.where("is_active", true);
  if (filter.status === "inactive") base.where("is_active", false);
  if (filter.role) base.where("role", filter.role);
  if (filter.profileId) base.where("access_profile_id", filter.profileId);

  const countQuery = base.clone().clearSelect().count<{ count: string }>("* as count").first();
  const rowsQuery = base
    .clone()
    .select("*")
    .orderBy("created_at", "desc")
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [countRow, rows] = await Promise.all([countQuery, rowsQuery]);
  return { rows, total: Number(countRow?.count ?? 0) };
}

export async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  const query = db("users")
    .where({ role: "admin", is_active: true })
    .whereNull("deleted_at")
    .count<{ count: string }>("* as count");
  if (excludeUserId) query.whereNot("id", excludeUserId);
  const row = await query.first();
  return Number(row?.count ?? 0);
}

export async function listUsersByIds(ids: string[]): Promise<UserRow[]> {
  if (ids.length === 0) return [];
  return db<UserRow>("users").whereIn("id", ids).whereNull("deleted_at");
}

/** Soft delete + anonymize personal data, keeping the row for usage history. */
export async function anonymizeUser(id: string): Promise<void> {
  await db("users")
    .where({ id })
    .update({
      name: "Deleted user",
      email: `deleted+${id}@anonymized.invalid`,
      is_active: false,
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}
