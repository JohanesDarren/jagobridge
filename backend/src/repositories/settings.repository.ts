import { db } from "../db/knex.js";

export interface SettingRow {
  key: string;
  value: unknown;
  updated_at: Date;
  updated_by: string | null;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db<SettingRow>("system_settings").select("key", "value");
  const result: Record<string, unknown> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const row = await db<SettingRow>("system_settings").where({ key }).first();
  return (row?.value as T) ?? undefined;
}

export async function upsertSetting(
  key: string,
  value: unknown,
  actorId: string | null,
): Promise<void> {
  await db("system_settings")
    .insert({ key, value: JSON.stringify(value), updated_by: actorId })
    .onConflict("key")
    .merge({ value: JSON.stringify(value), updated_by: actorId, updated_at: db.fn.now() });
}
