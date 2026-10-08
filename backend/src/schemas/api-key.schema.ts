import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expires_at: z.string().datetime().nullable().optional(),
});

export const listApiKeysQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
});
