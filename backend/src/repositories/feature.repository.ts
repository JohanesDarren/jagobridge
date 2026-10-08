import type { Knex } from "knex";
import { db } from "../db/knex.js";
import type { FeatureCode } from "../core/constants.js";

export interface FeatureRow {
  id: string;
  code: FeatureCode;
  name: string;
  description: string | null;
  is_enabled: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export async function listFeatures(): Promise<FeatureRow[]> {
  return db<FeatureRow>("features").whereNull("deleted_at").orderBy("code", "asc");
}

export async function findFeatureById(id: string): Promise<FeatureRow | undefined> {
  return db<FeatureRow>("features").where({ id }).whereNull("deleted_at").first();
}

export async function findFeatureByCode(code: FeatureCode): Promise<FeatureRow | undefined> {
  return db<FeatureRow>("features").where({ code }).whereNull("deleted_at").first();
}

export async function findFeaturesByCodes(codes: FeatureCode[]): Promise<FeatureRow[]> {
  if (codes.length === 0) return [];
  return db<FeatureRow>("features").whereIn("code", codes).whereNull("deleted_at");
}

export async function setFeatureEnabled(
  id: string,
  enabled: boolean,
  actorId: string,
): Promise<FeatureRow | undefined> {
  const [row] = await db<FeatureRow>("features")
    .where({ id })
    .update({ is_enabled: enabled, updated_by: actorId, updated_at: db.fn.now() })
    .returning("*");
  return row;
}

export async function getUserFeatureOverrides(
  userId: string,
  trx: Knex = db,
): Promise<Array<{ feature_id: string; effect: "allow" | "deny" }>> {
  return trx("user_feature_overrides").where({ user_id: userId }).select("feature_id", "effect");
}
