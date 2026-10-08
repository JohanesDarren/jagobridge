import type { Knex } from "knex";

/**
 * Seeds the four default features (catalog is defined in code) and the default
 * access profiles with the proposed limit values from PRD Q-08.
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

  const profiles = [
    {
      name: "Member",
      description: "Default profile for team members.",
      allow_all_models: false,
      limit_5h_tokens: 500_000,
      limit_weekly_tokens: 2_000_000,
      limit_rpm: 30,
      max_output_tokens_per_request: 4_096,
      is_default: true,
      featureCodes: ["streaming"],
    },
    {
      name: "Power User",
      description: "Higher limits for heavy users.",
      allow_all_models: false,
      limit_5h_tokens: 2_000_000,
      limit_weekly_tokens: 8_000_000,
      limit_rpm: 60,
      max_output_tokens_per_request: 8_192,
      is_default: false,
      featureCodes: ["streaming", "tool_calling", "json_mode"],
    },
    {
      name: "Admin",
      description: "Unlimited access for administrators.",
      allow_all_models: true,
      limit_5h_tokens: 0,
      limit_weekly_tokens: 0,
      limit_rpm: 0,
      max_output_tokens_per_request: 0,
      is_default: false,
      featureCodes: ["streaming", "tool_calling", "json_mode", "vision_input"],
    },
    {
      name: "Vision",
      description: "For users who need image input.",
      allow_all_models: false,
      limit_5h_tokens: 1_000_000,
      limit_weekly_tokens: 4_000_000,
      limit_rpm: 30,
      max_output_tokens_per_request: 4_096,
      is_default: false,
      featureCodes: ["streaming", "vision_input"],
    },
  ];

  for (const profile of profiles) {
    const { featureCodes, ...values } = profile;
    const existing = await knex("access_profiles").where({ name: profile.name }).first<{ id: string }>();
    let profileId: string;
    if (existing) {
      profileId = existing.id;
      await knex("access_profiles").where({ id: profileId }).update(values);
    } else {
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
