import { db } from "../db/knex.js";

export interface ChatSessionRow {
  id: string;
  user_id: string;
  title: string;
  model_id: string | null;
  model_public_name: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  attachment_path: string | null;
  usage_event_id: string | null;
  created_at: Date;
}

export async function listSessions(userId: string): Promise<ChatSessionRow[]> {
  return db<ChatSessionRow>("chat_sessions")
    .where({ user_id: userId })
    .whereNull("deleted_at")
    .orderBy("updated_at", "desc");
}

export async function findSessionById(id: string): Promise<ChatSessionRow | undefined> {
  return db<ChatSessionRow>("chat_sessions").where({ id }).whereNull("deleted_at").first();
}

export async function createSession(input: {
  userId: string;
  title: string;
  modelId: string | null;
  modelPublicName: string | null;
}): Promise<ChatSessionRow> {
  const [row] = await db<ChatSessionRow>("chat_sessions")
    .insert({
      user_id: input.userId,
      title: input.title,
      model_id: input.modelId,
      model_public_name: input.modelPublicName,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .returning("*");
  return row!;
}

export async function updateSession(
  id: string,
  patch: Partial<{ title: string; model_id: string | null; model_public_name: string | null }>,
): Promise<ChatSessionRow | undefined> {
  const [row] = await db<ChatSessionRow>("chat_sessions")
    .where({ id })
    .update({ ...patch, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

export async function softDeleteSession(id: string): Promise<void> {
  await db("chat_sessions").where({ id }).update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
}

export async function listMessages(sessionId: string): Promise<ChatMessageRow[]> {
  return db<ChatMessageRow>("chat_messages").where({ session_id: sessionId }).orderBy("created_at", "asc");
}

export async function insertMessage(input: {
  sessionId: string;
  role: "system" | "user" | "assistant";
  content: string;
  attachmentPath?: string | null;
  usageEventId?: string | null;
}): Promise<ChatMessageRow> {
  const [row] = await db<ChatMessageRow>("chat_messages")
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      attachment_path: input.attachmentPath ?? null,
      usage_event_id: input.usageEventId ?? null,
    })
    .returning("*");
  return row!;
}

export async function touchSession(id: string): Promise<void> {
  await db("chat_sessions").where({ id }).update({ updated_at: db.fn.now() });
}

/** Purges soft-deleted sessions (and their messages via cascade) older than the cutoff. */
export async function purgeDeletedSessionsBefore(date: Date): Promise<number> {
  const rows = await db("chat_sessions")
    .where("deleted_at", "<", date)
    .select<{ id: string }[]>("id");
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  await db("chat_messages").whereIn("session_id", ids).del();
  return db("chat_sessions").whereIn("id", ids).del();
}

/** Purges all messages of sessions inactive beyond the retention period. */
export async function purgeInactiveSessionsBefore(date: Date): Promise<number> {
  const rows = await db("chat_sessions")
    .where("updated_at", "<", date)
    .whereNull("deleted_at")
    .select<{ id: string }[]>("id");
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  await db("chat_messages").whereIn("session_id", ids).del();
  return db("chat_sessions").whereIn("id", ids).del();
}
