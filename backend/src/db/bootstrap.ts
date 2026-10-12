import { fileURLToPath } from "node:url";
import path from "node:path";
import { db } from "./knex.js";
import { logger } from "../core/logger.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(HERE, "migrations");
const SEEDS_DIR = path.join(HERE, "seeds");

/**
 * Run migrations and seeds from the compiled output.
 *
 * The package.json knex scripts shell out to `tsx ... knexfile.ts`, which only
 * works where devDependencies are installed. A production deploy installs prod
 * deps only, so this path uses the already-compiled .js files instead.
 *
 * Used by both the CLI (`bootstrap`) and, optionally, application startup
 * (RUN_MIGRATIONS_ON_START=true) for platforms whose runtime shell cannot
 * invoke node directly.
 */
export async function runMigrations(): Promise<number> {
  const [batch, applied] = await db.migrate.latest({
    directory: MIGRATIONS_DIR,
    extension: "js",
    loadExtensions: [".js"],
  });
  logger.info({ batch, applied: applied.length }, "migrations_applied");
  return applied.length;
}

export async function runSeeds(): Promise<number> {
  const [applied] = await db.seed.run({
    directory: SEEDS_DIR,
    extension: "js",
    loadExtensions: [".js"],
  });
  logger.info({ applied: applied.length }, "seeds_applied");
  return applied.length;
}

export async function bootstrapDatabase(): Promise<void> {
  await runMigrations();
  await runSeeds();
}
