import { createAdminCommand, type CreateAdminArgs } from "./create-admin.js";
import { syncModels } from "../services/model-sync.service.js";
import { runRetention } from "../jobs/retention.js";
import { closeDatabase } from "../db/knex.js";
import { closeRedis } from "../db/redis.js";

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
    await closeRedis();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    await closeDatabase().catch(() => undefined);
    await closeRedis().catch(() => undefined);
    process.exit(1);
  });
