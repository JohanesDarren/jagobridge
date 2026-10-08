import type { Knex } from "knex";
import { loadEnv } from "./src/core/env.js";

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

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection,
    pool: { min: env.PGPOOL_MIN, max: env.PGPOOL_MAX },
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
      loadExtensions: [".ts"],
    },
    seeds: {
      directory: "./src/db/seeds",
      extension: "ts",
      loadExtensions: [".ts"],
    },
  },
  test: {
    client: "pg",
    connection,
    pool: { min: 1, max: 5 },
    migrations: {
      directory: "./src/db/migrations",
      extension: "ts",
      loadExtensions: [".ts"],
    },
    seeds: {
      directory: "./src/db/seeds",
      extension: "ts",
      loadExtensions: [".ts"],
    },
  },
  production: {
    client: "pg",
    connection,
    pool: { min: env.PGPOOL_MIN, max: env.PGPOOL_MAX },
    migrations: {
      directory: "./dist/db/migrations",
      extension: "js",
      loadExtensions: [".js"],
    },
    seeds: {
      directory: "./dist/db/seeds",
      extension: "js",
      loadExtensions: [".js"],
    },
  },
};

export default config;
