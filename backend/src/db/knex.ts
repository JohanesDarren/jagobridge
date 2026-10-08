import knex, { type Knex } from "knex";
import { loadEnv } from "../core/env.js";

const env = loadEnv();

const connection = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: env.APP_ENV === "production" ? { rejectUnauthorized: false } : false,
    }
  : {
      host: env.PGHOST,
      port: env.PGPORT,
      user: env.PGUSER,
      password: env.PGPASSWORD,
      database: env.PGDATABASE,
    };

export const db: Knex = knex({
  client: "pg",
  connection,
  pool: { min: env.PGPOOL_MIN, max: env.PGPOOL_MAX },
  acquireConnectionTimeout: 10_000,
});

export async function pingDatabase(): Promise<boolean> {
  try {
    await db.raw("select 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
