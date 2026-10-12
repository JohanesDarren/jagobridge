import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAdminCommand, type CreateAdminArgs } from "./create-admin.js";
import { syncModels } from "../services/model-sync.service.js";
import { runRetention } from "../jobs/retention.js";
import { closeDatabase, db } from "../db/knex.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(HERE, "..", "db", "migrations");
const SEEDS_DIR = path.join(HERE, "..", "db", "seeds");

/**
 * Run migrations/seeds from the compiled output. The package.json knex scripts
 * shell out to `tsx ... knexfile.ts`, which only works where devDependencies are
 * installed; a production deploy installs prod deps only, so this path uses the
 * already-compiled .js files instead.
 */
async function runMigrations(): Promise<void> {
  const [batch, applied] = await db.migrate.latest({
    directory: MIGRATIONS_DIR,
    extension: "js",
    loadExtensions: [".js"],
  });
  process.stdout.write(`migrations: batch ${batch}, applied ${applied.length}\n`);
}

async function runSeeds(): Promise<void> {
  const [applied] = await db.seed.run({
    directory: SEEDS_DIR,
    extension: "js",
    loadExtensions: [".js"],
  });
  process.stdout.write(`seeds: applied ${applied.length}\n`);
}

function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = "true";
      }
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (command) {
    case "create-admin": {
      const args: CreateAdminArgs = {
        name: flags.name,
        email: flags.email,
        password: flags.password,
      };
      await createAdminCommand(args);
      break;
    }
    case "sync-models": {
      const result = await syncModels(null, { ip: null, userAgent: "cli" });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    case "migrate": {
      await runMigrations();
      break;
    }
    case "seed": {
      await runSeeds();
      break;
    }
    case "bootstrap": {
      await runMigrations();
      await runSeeds();
      break;
    }
    case "retention": {
      const result = await runRetention();
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      break;
    }
    default:
      process.stdout.write(
        [
          "JagoBridge CLI",
          "",
          "Usage: npm run cli -- <command> [--flags]",
          "",
          "Commands:",
          "  create-admin   Create the first admin (--name --email --password, otherwise prompts)",
          "  sync-models    Sync the model catalog from 9router",
          "  migrate        Run pending database migrations (compiled output)",
          "  seed           Run database seeds (compiled output)",
          "  bootstrap      migrate + seed in one go (first deploy)",
          "  retention      Run the data retention job",
          "",
        ].join("\n"),
      );
      break;
  }
}

main()
  .then(async () => {
    await closeDatabase();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    await closeDatabase().catch(() => undefined);
    process.exit(1);
  });
