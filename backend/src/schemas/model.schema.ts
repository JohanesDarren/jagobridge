import { z } from "zod";
import { PUBLIC_NAME_PATTERN } from "../core/constants.js";

export const updateModelSchema = z
  .object({
    public_name: z
      .string()
      .min(1)
      .max(100)
      .regex(
        PUBLIC_NAME_PATTERN,
        "Use lowercase letters, digits, dots, hyphens, and slashes only",
      )
      .optional(),
    display_name: z.string().min(1).max(255).optional(),
    token_multiplier: z.number().min(0.01).max(100).optional(),
    is_enabled: z.boolean().optional(),
    capabilities: z
      .object({
        tool_calling: z.boolean().optional(),
        vision_input: z.boolean().optional(),
        json_mode: z.boolean().optional(),
        context_length: z.number().int().positive().optional(),
      })
      .partial()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const listModelsQuerySchema = z.object({
  search: z.string().max(255).optional(),
  enabled: z.enum(["true", "false"]).optional(),
});
