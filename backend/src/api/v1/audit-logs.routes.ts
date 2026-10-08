import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { paginatedResponse, parsePagination, successResponse } from "../../schemas/response.js";
import { auditLogsQuerySchema } from "../../schemas/usage.schema.js";
import { listAuditLogs } from "../../repositories/audit.repository.js";

export const auditLogsRouter = Router();

auditLogsRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const query = auditLogsQuerySchema.parse(req.query);
    const pagination = parsePagination(query);
    const { rows, total } = await listAuditLogs(
      {
        actorUserId: query.actor_user_id,
        action: query.action,
        targetType: query.target_type,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      pagination,
    );
    const entries = rows.map((row) => ({
      id: row.id,
      actor_user_id: row.actor_user_id,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      before_state: row.before_state,
      after_state: row.after_state,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at.toISOString(),
    }));
    res
      .status(200)
      .json(paginatedResponse(entries, { total, page: pagination.page, limit: pagination.limit }));
  }),
);

// Kept for symmetry with the standard success envelope in other routers.
export const auditLogsHelpers = { successResponse };
