import type { Knex } from "knex";

/**
 * Package metadata for access profiles so the console can present them as
 * subscription packages (Harga, tier label, overage behaviour).
 *
 * - price_idr: monthly price in whole Indonesian rupiah (0 = free).
 * - tier_label: short marketing label shown as a chip ("Tingkat Gratis").
 * - overage_action: what happens once a quota window is exhausted
 *   ('cutoff' = block, 'allow' = keep serving over the limit).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("access_profiles", (table) => {
    table.integer("price_idr").notNullable().defaultTo(0);
    table.string("tier_label", 50).nullable();
    table.string("overage_action", 20).notNullable().defaultTo("cutoff");
    table.check("price_idr >= 0", [], "chk_profiles_price");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("access_profiles", (table) => {
    table.dropChecks("chk_profiles_price");
    table.dropColumn("price_idr");
    table.dropColumn("tier_label");
    table.dropColumn("overage_action");
  });
}
