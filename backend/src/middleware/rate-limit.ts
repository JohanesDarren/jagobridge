import rateLimit from "express-rate-limit";
import type { Request } from "express";

const standardHeaders = true;
const legacyHeaders = false;

function keyGenerator(req: Request): string {
  return req.ip ?? "unknown";
}

/** Login: 10 requests per minute per IP (PRD §6.4 auth endpoint). */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders,
  legacyHeaders,
  keyGenerator,
  message: {
    status: "error",
    message: "Too many sign-in attempts. Try again shortly.",
    error_code: "RATE_LIMIT_EXCEEDED",
  },
});

/** Management API: 100 requests per minute per IP (PRD §4.4). */
export const managementRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders,
  legacyHeaders,
  keyGenerator,
  message: {
    status: "error",
    message: "Too many requests. Try again shortly.",
    error_code: "RATE_LIMIT_EXCEEDED",
  },
});
