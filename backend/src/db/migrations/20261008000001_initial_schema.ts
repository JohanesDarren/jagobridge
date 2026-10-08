import type { Knex } from "knex";

/**
 * Initial schema (PRD §6.3). Creates every table in the documented order:
 * `users` first without the profile FK, then `access_profiles`, then the FK on
 * `users` is added with ALTER TABLE.
 *
 * Rollback drops everything in reverse dependency order.
 */
export async function up(knex: Knex): Promise<void> {
  const uuidDefault = () => knex.raw("gen_random_uuid()");

  // ------------------------------------------------------------------ users
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.string("name", 100).notNullable();
    table.string("email", 255).notNullable();
    table.string("password_hash", 255).notNullable();
    table.string("role", 20).notNullable().defaultTo("member");
    table.uuid("access_profile_id").nullable();
    table.bigInteger("limit_5h_tokens_override").nullable();
    table.bigInteger("limit_weekly_tokens_override").nullable();
    table.integer("limit_rpm_override").nullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.boolean("must_change_password").notNullable().defaultTo(true);
    table.boolean("usage_notice_acknowledged").notNullable().defaultTo(false);
    table.integer("failed_login_count").notNullable().defaultTo(0);
    table.timestamp("locked_until").nullable();
    table.timestamp("last_login_at").nullable();
    table.timestamp("deleted_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.uuid("updated_by").nullable().references("id").inTable("users");
    table.unique(["email"], { indexName: "uq_users_email" });
    table.check("role in ('admin','member')", [], "chk_users_role");
    table.index(["role"], "idx_users_role");
    table.index(["is_active"], "idx_users_is_active");
    table.index(["access_profile_id"], "idx_users_access_profile_id");
  });
  await knex.raw(
    "CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL",
  );

  // -------------------------------------------------------- access_profiles
  await knex.schema.createTable("access_profiles", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.string("name", 100).notNullable();
    table.text("description").nullable();
    table.boolean("allow_all_models").notNullable().defaultTo(false);
    table.bigInteger("limit_5h_tokens").notNullable().defaultTo(0);
    table.bigInteger("limit_weekly_tokens").notNullable().defaultTo(0);
    table.integer("limit_rpm").notNullable().defaultTo(0);
    table.integer("max_output_tokens_per_request").notNullable().defaultTo(0);
    table.boolean("is_default").notNullable().defaultTo(false);
    table.timestamp("deleted_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.uuid("updated_by").nullable().references("id").inTable("users");
    table.unique(["name"], { indexName: "uq_access_profiles_name" });
    table.check("limit_5h_tokens >= 0", [], "chk_profiles_limit_5h");
    table.check("limit_weekly_tokens >= 0", [], "chk_profiles_limit_weekly");
    table.check("limit_rpm >= 0", [], "chk_profiles_limit_rpm");
    table.check("max_output_tokens_per_request >= 0", [], "chk_profiles_max_output");
  });
  await knex.raw(
    "CREATE UNIQUE INDEX uq_access_profiles_default ON access_profiles(is_default) WHERE is_default = true AND deleted_at IS NULL",
  );

  await knex.schema.alterTable("users", (table) => {
    table
      .foreign("access_profile_id", "fk_users_access_profile")
      .references("id")
      .inTable("access_profiles")
      .onDelete("RESTRICT");
  });

  // --------------------------------------------------------------- features
  await knex.schema.createTable("features", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.string("code", 50).notNullable();
    table.string("name", 100).notNullable();
    table.text("description").nullable();
    table.boolean("is_enabled").notNullable().defaultTo(true);
    table.timestamp("deleted_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.uuid("updated_by").nullable().references("id").inTable("users");
    table.unique(["code"], { indexName: "uq_features_code" });
  });

  // --------------------------------------------------------- refresh_tokens
  await knex.schema.createTable("refresh_tokens", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("token_hash", 64).notNullable();
    table.timestamp("expires_at").notNullable();
    table.timestamp("revoked_at").nullable();
    table.string("revoked_reason", 20).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.string("user_agent", 255).nullable();
    table.unique(["token_hash"], { indexName: "uq_refresh_tokens_hash" });
    table.index(["user_id"], "idx_refresh_tokens_user_id");
    table.check(
      "revoked_reason is null or revoked_reason in ('rotated','logout','reuse','admin')",
      [],
      "chk_refresh_tokens_reason",
    );
  });

  // ------------------------------------------------------ user_invitations
  await knex.schema.createTable("user_invitations", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.string("email", 255).notNullable();
    table.string("role", 20).notNullable().defaultTo("member");
    table
      .uuid("access_profile_id")
      .notNullable()
      .references("id")
      .inTable("access_profiles")
      .onDelete("RESTRICT");
    table.string("token_hash", 64).notNullable();
    table.timestamp("expires_at").notNullable();
    table.timestamp("accepted_at").nullable();
    table.timestamp("revoked_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").notNullable().references("id").inTable("users");
    table.unique(["token_hash"], { indexName: "uq_user_invitations_token" });
    table.index(["email"], "idx_user_invitations_email");
    table.check("role in ('admin','member')", [], "chk_invitations_role");
  });

  // -------------------------------------------------------- profile_features
  await knex.schema.createTable("profile_features", (table) => {
    table
      .uuid("profile_id")
      .notNullable()
      .references("id")
      .inTable("access_profiles")
      .onDelete("CASCADE");
    table.uuid("feature_id").notNullable().references("id").inTable("features").onDelete("CASCADE");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.primary(["profile_id", "feature_id"]);
  });

  // ----------------------------------------------------------------- models
  await knex.schema.createTable("models", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.string("upstream_id", 255).notNullable();
    table.string("public_name", 100).notNullable();
    table.string("display_name", 255).notNullable();
    table.string("provider_label", 100).nullable();
    table.jsonb("capabilities").notNullable().defaultTo("{}");
    table.decimal("token_multiplier", 6, 2).notNullable().defaultTo(1.0);
    table.boolean("is_enabled").notNullable().defaultTo(false);
    table.boolean("is_available").notNullable().defaultTo(true);
    table.timestamp("last_synced_at").nullable();
    table.timestamp("deleted_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.uuid("updated_by").nullable().references("id").inTable("users");
    table.unique(["upstream_id"], { indexName: "uq_models_upstream_id" });
    table.unique(["public_name"], { indexName: "uq_models_public_name" });
    table.check("token_multiplier > 0", [], "chk_models_multiplier");
  });
  await knex.raw(
    "CREATE INDEX idx_models_enabled ON models(is_enabled, is_available) WHERE deleted_at IS NULL",
  );

  // ---------------------------------------------------------- profile_models
  await knex.schema.createTable("profile_models", (table) => {
    table
      .uuid("profile_id")
      .notNullable()
      .references("id")
      .inTable("access_profiles")
      .onDelete("CASCADE");
    table.uuid("model_id").notNullable().references("id").inTable("models").onDelete("CASCADE");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.primary(["profile_id", "model_id"]);
  });

  // --------------------------------------------------- user_model_overrides
  await knex.schema.createTable("user_model_overrides", (table) => {
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("model_id").notNullable().references("id").inTable("models").onDelete("CASCADE");
    table.string("effect", 10).notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.primary(["user_id", "model_id"]);
    table.check("effect in ('allow','deny')", [], "chk_user_model_overrides_effect");
  });

  // ------------------------------------------------- user_feature_overrides
  await knex.schema.createTable("user_feature_overrides", (table) => {
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("feature_id").notNullable().references("id").inTable("features").onDelete("CASCADE");
    table.string("effect", 10).notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.primary(["user_id", "feature_id"]);
    table.check("effect in ('allow','deny')", [], "chk_user_feature_overrides_effect");
  });

  // --------------------------------------------------------------- api_keys
  await knex.schema.createTable("api_keys", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.string("name", 100).notNullable();
    table.string("key_prefix", 12).notNullable();
    table.string("key_hash", 64).notNullable();
    table.timestamp("last_used_at").nullable();
    table.timestamp("expires_at").nullable();
    table.timestamp("revoked_at").nullable();
    table.timestamp("deleted_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.uuid("updated_by").nullable().references("id").inTable("users");
    table.unique(["key_hash"], { indexName: "uq_api_keys_hash" });
    table.index(["user_id"], "idx_api_keys_user_id");
  });

  // ----------------------------------------------------------- usage_events
  await knex.schema.createTable("usage_events", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.string("request_id", 64).notNullable();
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.uuid("api_key_id").nullable().references("id").inTable("api_keys").onDelete("SET NULL");
    table.uuid("model_id").nullable().references("id").inTable("models").onDelete("SET NULL");
    table.string("model_public_name", 100).notNullable();
    table.string("source", 20).notNullable();
    table.string("status", 20).notNullable();
    table.integer("prompt_tokens").notNullable().defaultTo(0);
    table.integer("completion_tokens").notNullable().defaultTo(0);
    table.decimal("token_multiplier", 6, 2).notNullable();
    table.bigInteger("weighted_tokens").notNullable().defaultTo(0);
    table.boolean("usage_estimated").notNullable().defaultTo(false);
    table.integer("latency_ms").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.check("source in ('api','playground')", [], "chk_usage_events_source");
    table.check(
      "status in ('success','upstream_error','client_cancelled')",
      [],
      "chk_usage_events_status",
    );
  });
  await knex.raw(
    "CREATE INDEX idx_usage_events_user_created ON usage_events(user_id, created_at DESC)",
  );
  await knex.raw(
    "CREATE INDEX idx_usage_events_model_created ON usage_events(model_id, created_at DESC)",
  );
  await knex.raw("CREATE INDEX idx_usage_events_created_at ON usage_events(created_at)");

  // ------------------------------------------------------------- audit_logs
  await knex.schema.createTable("audit_logs", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.uuid("actor_user_id").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("action", 100).notNullable();
    table.string("target_type", 50).notNullable();
    table.string("target_id", 100).nullable();
    table.jsonb("before_state").nullable();
    table.jsonb("after_state").nullable();
    table.specificType("ip_address", "inet").nullable();
    table.string("user_agent", 255).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(
    "CREATE INDEX idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at DESC)",
  );
  await knex.raw("CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id)");
  await knex.raw("CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC)");

  // -------------------------------------------------------- system_settings
  await knex.schema.createTable("system_settings", (table) => {
    table.string("key", 100).primary();
    table.jsonb("value").notNullable();
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("updated_by").nullable().references("id").inTable("users");
  });

  // ---------------------------------------------------------- chat_sessions
  await knex.schema.createTable("chat_sessions", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.string("title", 255).notNullable().defaultTo("New chat");
    table.uuid("model_id").nullable().references("id").inTable("models").onDelete("SET NULL");
    table.string("model_public_name", 100).nullable();
    table.timestamp("deleted_at").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.uuid("updated_by").nullable().references("id").inTable("users");
  });
  await knex.raw(
    "CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id) WHERE deleted_at IS NULL",
  );

  // ---------------------------------------------------------- chat_messages
  await knex.schema.createTable("chat_messages", (table) => {
    table.uuid("id").primary().defaultTo(uuidDefault());
    table
      .uuid("session_id")
      .notNullable()
      .references("id")
      .inTable("chat_sessions")
      .onDelete("CASCADE");
    table.string("role", 20).notNullable();
    table.text("content").notNullable();
    table.string("attachment_path", 500).nullable();
    table
      .uuid("usage_event_id")
      .nullable()
      .references("id")
      .inTable("usage_events")
      .onDelete("SET NULL");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.check("role in ('system','user','assistant')", [], "chk_chat_messages_role");
  });
  await knex.raw(
    "CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at)",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("chat_messages");
  await knex.schema.dropTableIfExists("chat_sessions");
  await knex.schema.dropTableIfExists("system_settings");
  await knex.schema.dropTableIfExists("audit_logs");
  await knex.schema.dropTableIfExists("usage_events");
  await knex.schema.dropTableIfExists("api_keys");
  await knex.schema.dropTableIfExists("user_feature_overrides");
  await knex.schema.dropTableIfExists("user_model_overrides");
  await knex.schema.dropTableIfExists("profile_models");
  await knex.schema.dropTableIfExists("models");
  await knex.schema.dropTableIfExists("profile_features");
  await knex.schema.dropTableIfExists("user_invitations");
  await knex.schema.dropTableIfExists("refresh_tokens");
  await knex.schema.dropTableIfExists("features");
  await knex.schema.alterTable("users", (table) => {
    table.dropForeign("access_profile_id", "fk_users_access_profile");
  });
  await knex.schema.dropTableIfExists("access_profiles");
  await knex.schema.dropTableIfExists("users");
}
