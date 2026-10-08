import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { validatePasswordComplexity } from "../core/security.js";
import { createFirstAdmin } from "../services/user.service.js";

export interface CreateAdminArgs {
  name?: string;
  email?: string;
  password?: string;
}

async function promptForMissing(args: CreateAdminArgs): Promise<Required<CreateAdminArgs>> {
  const rl = readline.createInterface({ input, output });
  try {
    const name = args.name ?? (await rl.question("Admin name: ")).trim();
    const email = args.email ?? (await rl.question("Admin email: ")).trim();
    const password = args.password ?? (await rl.question("Admin password: ")).trim();
    return { name, email, password };
  } finally {
    rl.close();
  }
}

/** `npm run cli -- create-admin` — there is no UI path to create the first admin (PRD F-02). */
export async function createAdminCommand(args: CreateAdminArgs): Promise<void> {
  const { name, email, password } = await promptForMissing(args);

  if (!name) throw new Error("Name is required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A valid email is required");

  const check = validatePasswordComplexity(password);
  if (!check.valid) {
    throw new Error(`Password does not meet the requirements:\n  - ${check.errors.join("\n  - ")}`);
  }

  const user = await createFirstAdmin(name, email, password);
  output.write(`\nAdmin created: ${user.email} (${user.id})\n`);
  output.write("You can now sign in at the console.\n");
}
