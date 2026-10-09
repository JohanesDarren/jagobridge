import type { Knex } from "knex";
import { hashPassword } from "../../core/security.js";
import type { ModelCapabilities } from "../../repositories/model.repository.js";

/**
 * Idempotent bootstrap seed: guarantees an admin account exists and seeds a
 * curated slice of the 9router catalog. The `:free` model is enabled and granted
 * to every standard (non-allow-all) profile so it is usable out of the box.
 *
 * Credentials come from env with dev defaults:
 *   SEED_ADMIN_NAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 */

const SEED_ADMIN = {
  name: process.env.SEED_ADMIN_NAME ?? "Administrator",
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@jago.com",
  password: process.env.SEED_ADMIN_PASSWORD ?? "jagoai5758",
};

interface SeedModel {
  upstream_id: string;
  display_name: string;
  provider_label: string;
  capabilities: ModelCapabilities;
  token_multiplier: number;
  is_enabled: boolean;
  /** Grant to every profile without allow_all_models (i.e. all standard profiles). */
  grantToStandardProfiles: boolean;
}

/**
 * Curated models pulled from https://9router.jagoai.dev/v1. Capabilities are
 * stored using the app's normalised keys (PRD F-05).
 */
const SEED_MODELS: SeedModel[] = [
  {
    upstream_id: "kc/poolside/laguna-xs-2.1:free",
    display_name: "Laguna XS 2.1 (Free)",
    provider_label: "kc",
    capabilities: { tool_calling: true, vision_input: false, context_length: 200_000 },
    token_multiplier: 1,
    is_enabled: true,
    grantToStandardProfiles: true,
  },
  {
    upstream_id: "groq/openai/gpt-oss-120b",
    display_name: "GPT-OSS 120B",
    provider_label: "groq",
    capabilities: { tool_calling: true, vision_input: false, context_length: 128_000 },
    token_multiplier: 1,
    is_enabled: true,
    grantToStandardProfiles: false,
  },
  {
    upstream_id: "ocg/glm-5.2",
    display_name: "GLM 5.2",
    provider_label: "ocg",
    capabilities: { tool_calling: true, vision_input: false, context_length: 200_000 },
    token_multiplier: 1,
    is_enabled: true,
    grantToStandardProfiles: false,
  },
  {
    upstream_id: "vyce-ai/claude-sonnet-4-6",
    display_name: "Claude Sonnet 4.6",
    provider_label: "vyce-ai",
    capabilities: { tool_calling: true, vision_input: true, context_length: 1_000_000 },
    token_multiplier: 1,
    is_enabled: true,
    grantToStandardProfiles: false,
  },
  {
    upstream_id: "cmc/deepseek/deepseek-v4-flash",
    display_name: "DeepSeek V4 Flash",
    provider_label: "cmc",
    capabilities: { tool_calling: true, vision_input: false, context_length: 1_000_000 },
    token_multiplier: 1,
    is_enabled: true,
    grantToStandardProfiles: false,
  },
];

export async function seed(knex: Knex): Promise<void> {
  // 1. Admin account --------------------------------------------------------
  const existingAdmin = await knex("users")
    .where({ role: "admin" })
    .whereNull("deleted_at")
    .first<{ id: string }>("id");

  let adminId = existingAdmin?.id ?? null;

  if (!adminId) {
    const adminProfile = await knex("access_profiles")
      .whereNull("deleted_at")
      .orderByRaw("allow_all_models desc, is_default desc")
      .first<{ id: string }>("id");

    const passwordHash = await hashPassword(SEED_ADMIN.password);
    const [row] = await knex("users")
      .insert({
        name: SEED_ADMIN.name,
        email: SEED_ADMIN.email,
        password_hash: passwordHash,
        role: "admin",
        access_profile_id: adminProfile?.id ?? null,
        must_change_password: false,
      })
      .returning<{ id: string }[]>("id");
    adminId = row!.id;
  }

  // 2. Model catalog --------------------------------------------------------
  const standardProfiles = await knex("access_profiles")
    .where({ allow_all_models: false })
    .whereNull("deleted_at")
    .select<{ id: string }[]>("id");

  for (const model of SEED_MODELS) {
    const existing = await knex("models")
      .where({ upstream_id: model.upstream_id })
      .first<{ id: string }>("id");

    let modelId: string;
    if (existing) {
      modelId = existing.id;
      await knex("models")
        .where({ id: modelId })
        .update({
          display_name: model.display_name,
          provider_label: model.provider_label,
          capabilities: JSON.stringify(model.capabilities),
          token_multiplier: String(model.token_multiplier),
          is_enabled: model.is_enabled,
          is_available: true,
          last_synced_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
    } else {
      const [row] = await knex("models")
        .insert({
          upstream_id: model.upstream_id,
          public_name: model.upstream_id,
          display_name: model.display_name,
          provider_label: model.provider_label,
          capabilities: JSON.stringify(model.capabilities),
          token_multiplier: String(model.token_multiplier),
          is_enabled: model.is_enabled,
          is_available: true,
          last_synced_at: knex.fn.now(),
          created_by: adminId,
          updated_by: adminId,
        })
        .returning<{ id: string }[]>("id");
      modelId = row!.id;
    }

    if (model.grantToStandardProfiles) {
      for (const profile of standardProfiles) {
        await knex("profile_models")
          .insert({ profile_id: profile.id, model_id: modelId, created_by: adminId })
          .onConflict(["profile_id", "model_id"])
          .ignore();
      }
    }
  }
}
