import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ path: path.resolve(process.cwd(), ".env") });

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(defaultValue)
    .transform((value) =>
      typeof value === "boolean" ? value : ["1", "true", "yes", "on"].includes(value.toLowerCase()),
    );

/**
 * Single source of truth for environment configuration.
 * Validated once at startup (PRD §7.2: all config comes from .env, validated with Zod).
 */
const envSchema = z.object({
  // Application
  APP_NAME: z.string().default("jagobridge"),
  APP_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  APP_DEBUG: booleanFromEnv(false),
  APP_SECRET_KEY: z.string().min(32, "APP_SECRET_KEY must be at least 32 characters"),
  FRONTEND_BASE_URL: z.string().url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Jakarta"),

  // Server
  PORT: z.coerce.number().int().positive().default(5000),

  // Database
  DATABASE_URL: z.string().optional(),
  PGUSER: z.string().default("jago"),
  PGHOST: z.string().default("localhost"),
  PGDATABASE: z.string().default("jagobridge"),
  PGPASSWORD: z.string().default("jago"),
  PGPORT: z.coerce.number().int().positive().default(5432),
  PGPOOL_MIN: z.coerce.number().int().min(0).default(2),
  PGPOOL_MAX: z.coerce.number().int().min(1).default(10),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379/0"),

  // JWT / Auth
  JWT_SECRET_KEY: z.string().min(32, "JWT_SECRET_KEY must be at least 32 characters"),
  JWT_ALGORITHM: z.string().default("HS256"),
  JWT_ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive().default(60),
  JWT_REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().int().positive().default(7),
  LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  INVITATION_EXPIRE_HOURS: z.coerce.number().int().positive().default(72),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

  // Upstream 9router
  UPSTREAM_BASE_URL: z.string().url().default("https://9router.jagoai.dev/v1"),
  UPSTREAM_API_KEY: z.string().default(""),
  UPSTREAM_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(5),
  UPSTREAM_FIRST_BYTE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  UPSTREAM_STREAM_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  MODEL_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),

  // Gateway safety
  GATEWAY_ENABLED: booleanFromEnv(true),
  MAX_INFLIGHT_REQUESTS_PER_USER: z.coerce.number().int().min(1).max(20).default(5),
  USAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  PLAYGROUND_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  PLAYGROUND_UPLOAD_DIR: z.string().default("./data/uploads"),
  PLAYGROUND_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(5),

  // Email
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().default("JagoBridge <no-reply@team.example>"),

  // Monitoring
  SENTRY_DSN: z.string().default(""),
  LOG_LEVEL: z.enum(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]).default("INFO"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

/**
 * Parses and validates environment variables. Throws a readable error at
 * startup if anything required is missing (fail fast, PRD §7.1).
 */
export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}
