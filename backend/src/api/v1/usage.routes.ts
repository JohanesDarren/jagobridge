import { Router } from "express";
import { AppError } from "../../core/errors.js";
import { MAX_EXPORT_DAYS, MAX_EXPORT_ROWS } from "../../core/constants.js";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { paginatedResponse, parsePagination, successResponse } from "../../schemas/response.js";
import {
  usageEventsQuerySchema,
  usageExportQuerySchema,
  usageStatsQuerySchema,
  usageSummaryQuerySchema,
} from "../../schemas/usage.schema.js";
import { findUserById, listUsersByIds } from "../../repositories/user.repository.js";
import { resolveEffectiveAccess } from "../../services/access.service.js";
import { getQuotaSnapshot, type WindowUsage } from "../../services/usage.service.js";
import {
  latencyByModelName,
  latencyPercentiles,
  listAllUsageEventsForExport,
  listUsageEvents,
  usageByModel,
  usageByProvider,
  usageByStatusCode,
  usageByUser,
  usageDaily,
  usageHourly,
  usageTotals,
  type ListUsageFilter,
} from "../../repositories/usage.repository.js";
import { recordAudit } from "../../services/audit.service.js";

export const usageRouter = Router();

function windowDto(window: WindowUsage) {
  return {
    used_tokens: window.usedTokens,
    limit_tokens: window.limitTokens,
    remaining_tokens: window.remainingTokens,
    reset_at: window.resetAt ? window.resetAt.toISOString() : null,
    state: window.state,
  };
}

async function resolveTargetUser(req: { authUser?: { id: string; role: string } }, userId?: string) {
  const caller = req.authUser!;
  if (userId && userId !== caller.id) {
    if (caller.role !== "admin") {
      throw new AppError(403, "FORBIDDEN", "You can only view your own usage");
    }
    const target = await findUserById(userId);
    if (!target) throw new AppError(404, "NOT_FOUND", "User not found");
    return target;
  }
  const target = await findUserById(caller.id);
  if (!target) throw new AppError(404, "NOT_FOUND", "User not found");
  return target;
}

/**
 * Team-wide scope for admins, own scope for members, single-user scope when an
 * explicit `user_id` is supplied (admins only).
 */
async function resolveScope(
  req: { authUser?: { id: string; role: string } },
  userId?: string,
): Promise<{ userId?: string }> {
  const caller = req.authUser!;
  const admin = caller.role === "admin";
  if (userId) {
    if (userId !== caller.id && !admin) {
      throw new AppError(403, "FORBIDDEN", "You can only view your own usage");
    }
    const target = await findUserById(userId);
    if (!target) throw new AppError(404, "NOT_FOUND", "User not found");
    return { userId: target.id };
  }
  if (admin) return {};
  const self = await findUserById(caller.id);
  if (!self) throw new AppError(404, "NOT_FOUND", "User not found");
  return { userId: self.id };
}

usageRouter.get(
  "/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user_id } = usageSummaryQuerySchema.parse(req.query);
    const target = await resolveTargetUser(req, user_id);
    const access = await resolveEffectiveAccess(target);
    const quota = await getQuotaSnapshot(target.id, access.limits);
    res.status(200).json(
      successResponse(
        {
          user_id: target.id,
          windows: {
            five_hour: windowDto(quota.fiveHour),
            weekly: windowDto(quota.weekly),
          },
          rpm: { limit: quota.rpmLimit },
          calculated_at: new Date().toISOString(),
        },
        "Usage summary retrieved",
      ),
    );
  }),
);

usageRouter.get(
  "/events",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = usageEventsQuerySchema.parse(req.query);
    const scope = await resolveScope(req, query.user_id);
    const pagination = parsePagination(query);
    const filter: ListUsageFilter = {
      userId: scope.userId,
      modelId: query.model_id,
      source: query.source,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
    const { rows, total } = await listUsageEvents(filter, pagination);
    const distinctUserIds = [...new Set(rows.map((row) => row.user_id))];
    const users = await listUsersByIds(distinctUserIds);
    const userById = new Map(users.map((user) => [user.id, user]));
    const events = rows.map((row) => ({
      id: row.id,
      request_id: row.request_id,
      user_id: row.user_id,
      user_email: userById.get(row.user_id)?.email ?? null,
      user_name: userById.get(row.user_id)?.name ?? null,
      model_public_name: row.model_public_name,
      source: row.source,
      status: row.status,
      upstream_status: row.upstream_status,
      prompt_tokens: row.prompt_tokens,
      completion_tokens: row.completion_tokens,
      cached_tokens: row.cached_tokens,
      token_multiplier: Number(row.token_multiplier),
      weighted_tokens: Number(row.weighted_tokens),
      usage_estimated: row.usage_estimated,
      latency_ms: row.latency_ms,
      created_at: row.created_at.toISOString(),
    }));
    res
      .status(200)
      .json(paginatedResponse(events, { total, page: pagination.page, limit: pagination.limit }));
  }),
);

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeToDates(range: string, from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (range === "24h") return { from: new Date(now.getTime() - DAY_MS), to: now };
  if (range === "7d") return { from: new Date(now.getTime() - 7 * DAY_MS), to: now };
  if (range === "30d") return { from: new Date(now.getTime() - 30 * DAY_MS), to: now };
  if (range === "60d") return { from: new Date(now.getTime() - 60 * DAY_MS), to: now };
  // "all": no lower bound that can realistically exclude a recorded event.
  if (range === "all") return { from: new Date(2000, 0, 1), to: now };
  return {
    from: from ? new Date(from) : new Date(now.getTime() - 7 * DAY_MS),
    to: to ? new Date(to) : now,
  };
}

usageRouter.get(
  "/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = usageStatsQuerySchema.parse(req.query);
    const scope = await resolveScope(req, query.user_id);
    const { from, to } = rangeToDates(query.range, query.from, query.to);
    const filter: ListUsageFilter = { userId: scope.userId, from, to, modelId: query.model_id };

    const [totals, byModel, daily, hourly, byProvider, statusCodes, latency, modelLatencies] =
      await Promise.all([
        usageTotals(filter),
        usageByModel(filter, 10),
        usageDaily(filter),
        usageHourly(filter),
        usageByProvider(filter),
        usageByStatusCode(filter),
        latencyPercentiles(filter),
        latencyByModelName(filter),
      ]);

    const isAdmin = req.authUser!.role === "admin";
    const teamFilter: ListUsageFilter = { from, to, modelId: query.model_id };
    const byUser = isAdmin ? await usageByUser(teamFilter, 10) : [];

    const latencyByName = new Map(modelLatencies.map((row) => [row.model_public_name, row]));

    res.status(200).json(
      successResponse(
        {
          range: { from: from.toISOString(), to: to.toISOString() },
          totals: {
            weighted_tokens: Number(totals.weighted_tokens ?? 0),
            prompt_tokens: Number(totals.prompt_tokens ?? 0),
            completion_tokens: Number(totals.completion_tokens ?? 0),
            cached_tokens: Number(totals.cached_tokens ?? 0),
            requests: Number(totals.requests ?? 0),
            errors: Number(totals.errors ?? 0),
            avg_latency_ms: Number(totals.avg_latency_ms ?? 0),
            client_4xx: Number(totals.client_4xx ?? 0),
            server_5xx: Number(totals.server_5xx ?? 0),
          },
          by_model: byModel.map((row) => ({
            model_public_name: row.model_public_name,
            weighted_tokens: Number(row.weighted_tokens),
            requests: Number(row.requests),
            latency: {
              p50: latencyByName.get(row.model_public_name)?.p50 ?? null,
              p95: latencyByName.get(row.model_public_name)?.p95 ?? null,
            },
          })),
          by_user: byUser.map((row) => ({
            user_id: row.user_id,
            weighted_tokens: Number(row.weighted_tokens),
            requests: Number(row.requests),
          })),
          by_provider: byProvider.map((row) => ({
            provider: row.provider,
            requests: Number(row.requests),
            weighted_tokens: Number(row.weighted_tokens),
            avg_latency_ms: Number(row.avg_latency_ms ?? 0),
          })),
          by_status_code: statusCodes.map((row) => ({
            upstream_status: row.upstream_status,
            requests: Number(row.requests),
          })),
          daily: daily.map((row) => ({
            day: row.day,
            weighted_tokens: Number(row.weighted_tokens),
            requests: Number(row.requests),
            prompt_tokens: Number(row.prompt_tokens),
            completion_tokens: Number(row.completion_tokens),
            cached_tokens: Number(row.cached_tokens),
          })),
          hourly: hourly.map((row) => ({
            hour: row.hour,
            weighted_tokens: Number(row.weighted_tokens),
            requests: Number(row.requests),
            prompt_tokens: Number(row.prompt_tokens),
            completion_tokens: Number(row.completion_tokens),
            cached_tokens: Number(row.cached_tokens),
          })),
          latency,
        },
        "Usage statistics retrieved",
      ),
    );
  }),
);

usageRouter.get(
  "/export",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = usageExportQuerySchema.parse(req.query);
    const target = await resolveTargetUser(req, query.user_id);
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;

    const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (spanDays > MAX_EXPORT_DAYS) {
      throw new AppError(400, "VALIDATION_ERROR", `Export range cannot exceed ${MAX_EXPORT_DAYS} days`, {
        from: [`Maximum range is ${MAX_EXPORT_DAYS} days`],
      });
    }

    const rows = await listAllUsageEventsForExport(
      {
        userId: target.id,
        from,
        to,
        modelId: query.model_id,
        source: query.source,
        status: query.status,
      },
      MAX_EXPORT_ROWS,
    );

    const header = [
      "timestamp_utc",
      "user_email",
      "model_public_name",
      "source",
      "status",
      "prompt_tokens",
      "completion_tokens",
      "token_multiplier",
      "weighted_tokens",
      "usage_estimated",
    ].join(",");

    const lines = rows.map((row) =>
      [
        row.created_at.toISOString(),
        target.email,
        row.model_public_name,
        row.source,
        row.status,
        row.prompt_tokens,
        row.completion_tokens,
        Number(row.token_multiplier).toFixed(2),
        Number(row.weighted_tokens),
        row.usage_estimated,
      ].join(","),
    );

    await recordAudit({
      actorUserId: req.authUser!.id,
      action: "usage.export",
      targetType: "usage_event",
      targetId: target.id,
      afterState: { rows: rows.length, from: from.toISOString(), to: to.toISOString() },
      ipAddress: requestMeta(req).ip,
      userAgent: requestMeta(req).userAgent,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="jagobridge-usage-${now.toISOString().slice(0, 10)}.csv"`,
    );
    res.status(200).send([header, ...lines].join("\n"));
  }),
);
