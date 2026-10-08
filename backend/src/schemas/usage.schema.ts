import { z } from "zod";

export const usageSummaryQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
});

export const usageEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  user_id: z.string().uuid().optional(),
  model_id: z.string().uuid().optional(),
  source: z.enum(["api", "playground"]).optional(),
  status: z.enum(["success", "upstream_error", "client_cancelled"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const usageStatsQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  range: z.enum(["24h", "7d", "30d", "custom"]).default("7d"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  model_id: z.string().uuid().optional(),
});

export const usageExportQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  model_id: z.string().uuid().optional(),
  source: z.enum(["api", "playground"]).optional(),
  status: z.enum(["success", "upstream_error", "client_cancelled"]).optional(),
});

export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  actor_user_id: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  target_type: z.string().max(50).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
