import type { Knex } from "knex";

/**
 * 9router reports `usage.prompt_tokens_details.cached_tokens`; the usage
 * analytics view breaks input tokens into fresh vs cached, so the number is
 * stored alongside the prompt/completion counts. Rows written before this
 * migration (and responses without the detail block) hold 0.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_events", (table) => {
    table.integer("cached_tokens").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_events", (table) => {
    table.dropColumn("cached_tokens");
  });
}
