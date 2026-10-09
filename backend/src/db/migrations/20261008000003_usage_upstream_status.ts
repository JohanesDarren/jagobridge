import type { Knex } from "knex";

/**
 * Stores the HTTP status returned by 9router for a gateway request so the
 * console can report real status codes (200/401/402/429/...) instead of only
 * the internal success/error classification.
 *
 * NULL means the request never reached the upstream (blocked by the pipeline,
 * or the upstream was unreachable / timed out before responding).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_events", (table) => {
    table.integer("upstream_status").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_events", (table) => {
    table.dropColumn("upstream_status");
  });
}
