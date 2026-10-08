import { z } from "zod";

export const updateSettingsSchema = z
  .object({
    default_timezone: z.string().min(1).max(100).optional(),
    model_sync_interval_minutes: z.number().int().min(15).max(1440).optional(),
    playground_retention_days: z.number().int().min(7).max(365).optional(),
    max_inflight_requests_per_user: z.number().int().min(1).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });
