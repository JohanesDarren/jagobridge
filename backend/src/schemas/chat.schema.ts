import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  model_id: z.string().uuid().optional(),
  model_public_name: z.string().max(100).optional(),
});

export const updateSessionSchema = z
  .object({ title: z.string().min(1).max(255) })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided" });

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(100_000),
  model_public_name: z.string().max(100).optional(),
  attachment_path: z.string().max(500).nullable().optional(),
});
