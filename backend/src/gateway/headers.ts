import type { Response } from "express";
import type { QuotaSnapshot } from "../services/usage.service.js";
import type { RpmCheckResult } from "../services/rate-limit.service.js";

/**
 * Every response (management API and gateway) carries these headers (PRD §6.4).
 * `-1` means unlimited.
 */
export function setRateLimitHeaders(res: Response, rpm: RpmCheckResult): void {
  res.setHeader("X-RateLimit-Limit", String(rpm.limit));
  res.setHeader("X-RateLimit-Remaining", String(rpm.remaining));
  res.setHeader("X-RateLimit-Reset", String(rpm.resetAt));
}

export function setUsageHeaders(res: Response, snapshot: QuotaSnapshot): void {
  res.setHeader("X-Usage-5h-Remaining", String(snapshot.fiveHour.remainingTokens));
  res.setHeader("X-Usage-Weekly-Remaining", String(snapshot.weekly.remainingTokens));
}

export function setGatewayHeaders(res: Response, rpm: RpmCheckResult, snapshot: QuotaSnapshot): void {
  setRateLimitHeaders(res, rpm);
  setUsageHeaders(res, snapshot);
}
