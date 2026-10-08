import pino from "pino";
import { loadEnv } from "./env.js";

const env = loadEnv();

const LEVEL_MAP: Record<string, string> = {
  DEBUG: "debug",
  INFO: "info",
  WARNING: "warn",
  ERROR: "error",
  CRITICAL: "fatal",
};

/**
 * Structured JSON logger (PRD §9.2). PII masking is enforced by never passing
 * sensitive fields to the logger (PRD §9.3).
 */
export const logger = pino({
  level: LEVEL_MAP[env.LOG_LEVEL] ?? "info",
  base: { service: "jagobridge" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "*.password",
      "tokens",
      "*.token",
      "apiKey",
      "*.apiKey",
      "api_key",
      "*.api_key",
      "refresh_token",
      "*.refresh_token",
      "access_token",
      "*.access_token",
      "authorization",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;
