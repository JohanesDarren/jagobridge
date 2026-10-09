import type { Knex } from "knex";

/**
 * Seeds the four default features (catalog is defined in code), the default
 * package catalog, and the default system settings.
 *
 * Packages are stored in `access_profiles`. Quotas are expressed in weighted
 * tokens; the console derives the rupiah view at IDR 0.02 per token, so the
 * seeded token limits line up with the catalogue prices (PRD Q-08 extended
 * with the package tiers used by the console).
 */
export async function seed(knex: Knex): Promise<void> {
  const features = [
    {
      code: "streaming",
      name: "Streaming",
      description: "Stream responses token by token (Server-Sent Events).",
    },
    {
      code: "tool_calling",
      name: "Tool Calling",
      description: "Send requests with tools or functions.",
    },
    {
      code: "vision_input",
      name: "Vision Input",
      description: "Send image content parts in messages.",
    },
    {
      code: "json_mode",
      name: "JSON Mode",
      description: "Request structured output with response_format.",
    },
  ];

  for (const feature of features) {
    const existing = await knex("features").where({ code: feature.code }).first();
    if (!existing) {
      await knex("features").insert(feature);
    }
  }

  const featureRows = await knex("features").select<{ id: string; code: string }[]>("id", "code");
  const featureIdByCode = new Map(featureRows.map((row) => [row.code, row.id]));

  // The first release shipped role-based profiles. Align those rows with the
  // package catalog so existing installs do not end up with duplicates.
  const legacyRenames: Array<[string, string]> = [
    ["Member", "Free"],
    ["Power User", "Starter"],
    ["Vision", "Pro"],
  ];
  for (const [from, to] of legacyRenames) {
    const source = await knex("access_profiles").where({ name: from }).first<{ id: string }>();
    const target = await knex("access_profiles").where({ name: to }).first<{ id: string }>();
    if (source && !target) {
      await knex("access_profiles").where({ id: source.id }).update({ name: to });
    }
  }

  const profiles = [
    {
      name: "Free",
      tier_label: "Tingkat Gratis",
      description: "Trial tier with a starter balance for every model.",
      allow_all_models: true,
      price_idr: 0,
      limit_5h_tokens: 125_000,
      limit_weekly_tokens: 250_000,
      limit_rpm: 30,
      max_output_tokens_per_request: 4_096,
      overage_action: "cutoff",
      is_default: true,
      featureCodes: ["streaming"],
    },
    {
      name: "Starter",
      tier_label: "Tingkat Pemula",
      description: "Good for testing and early integrations.",
      allow_all_models: true,
      price_idr: 35_000,
      limit_5h_tokens: 875_000,
      limit_weekly_tokens: 1_750_000,
      limit_rpm: 60,
      max_output_tokens_per_request: 8_192,
      overage_action: "cutoff",
      is_default: false,
      featureCodes: ["streaming", "json_mode"],
    },
    {
      name: "Basic",
      tier_label: "Paling Populer",
      description: "The favourite plan for personal projects and small sites.",
      allow_all_models: true,
      price_idr: 65_000,
      limit_5h_tokens: 1_625_000,
      limit_weekly_tokens: 3_250_000,
      limit_rpm: 100,
      max_output_tokens_per_request: 8_192,
      overage_action: "cutoff",
      is_default: false,
      featureCodes: ["streaming", "tool_calling", "json_mode"],
    },
    {
      name: "Pro",
      tier_label: "Rekomendasi Dev",
      description: "Ideal capacity for active freelancers and software engineers.",
      allow_all_models: true,
      price_idr: 125_000,
      limit_5h_tokens: 3_125_000,
      limit_weekly_tokens: 6_250_000,
      limit_rpm: 150,
      max_output_tokens_per_request: 16_384,
      overage_action: "cutoff",
      is_default: false,
      featureCodes: ["streaming", "tool_calling", "json_mode", "vision_input"],
    },
    {
      name: "Business",
      tier_label: "Skala Bisnis",
      description: "For teams and production applications with steady traffic.",
      allow_all_models: true,
      price_idr: 300_000,
      limit_5h_tokens: 7_500_000,
      limit_weekly_tokens: 15_000_000,
      limit_rpm: 300,
      max_output_tokens_per_request: 32_768,
      overage_action: "cutoff",
      is_default: false,
      featureCodes: ["streaming", "tool_calling", "json_mode", "vision_input"],
    },
    {
      name: "Enterprise",
      tier_label: "Solusi Skala Besar",
      description: "Maximum capacity with the highest rate limit.",
      allow_all_models: true,
      price_idr: 600_000,
      limit_5h_tokens: 15_000_000,
      limit_weekly_tokens: 30_000_000,
      limit_rpm: 500,
      max_output_tokens_per_request: 65_536,
      overage_action: "cutoff",
      is_default: false,
      featureCodes: ["streaming", "tool_calling", "json_mode", "vision_input"],
    },
    {
      name: "Admin",
      tier_label: "Internal",
      description: "Unlimited access for administrators.",
      allow_all_models: true,
      price_idr: 0,
      limit_5h_tokens: 0,
      limit_weekly_tokens: 0,
      limit_rpm: 0,
      max_output_tokens_per_request: 0,
      overage_action: "allow",
      is_default: false,
      featureCodes: ["streaming", "tool_calling", "json_mode", "vision_input"],
    },
  ];

  for (const profile of profiles) {
    const { featureCodes, ...values } = profile;
    const existing = await knex("access_profiles").where({ name: profile.name }).first<{ id: string }>();
    let profileId: string;
    if (existing) {
      profileId = existing.id;
      // Only one profile may be the default (partial unique index).
      if (values.is_default) {
        await knex("access_profiles").whereNot({ id: profileId }).update({ is_default: false });
      }
      await knex("access_profiles").where({ id: profileId }).update(values);
    } else {
      if (values.is_default) {
        await knex("access_profiles").update({ is_default: false });
      }
      const inserted = await knex("access_profiles")
        .insert(values)
        .returning<{ id: string }[]>("id");
      profileId = inserted[0]!.id;
    }

    await knex("profile_features").where({ profile_id: profileId }).del();
    const rows = featureCodes
      .map((code) => featureIdByCode.get(code))
      .filter((id): id is string => Boolean(id))
      .map((featureId) => ({ profile_id: profileId, feature_id: featureId }));
    if (rows.length > 0) {
      await knex("profile_features").insert(rows);
    }
  }

  // Default system settings (PRD F-12).
  const defaultSettings: Array<{ key: string; value: unknown }> = [
    { key: "default_timezone", value: "Asia/Jakarta" },
    { key: "model_sync_interval_minutes", value: 60 },
    { key: "playground_retention_days", value: 90 },
    { key: "max_inflight_requests_per_user", value: 5 },
  ];
  for (const setting of defaultSettings) {
    const existing = await knex("system_settings").where({ key: setting.key }).first();
    if (!existing) {
      await knex("system_settings").insert({
        key: setting.key,
        value: JSON.stringify(setting.value),
      });
    }
  }
}
