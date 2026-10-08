import { z } from "zod";

const limit = z.number().int().min(0);

export const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  allow_all_models: z.boolean().default(false),
  limit_5h_tokens: limit.default(0),
  limit_weekly_tokens: limit.default(0),
  limit_rpm: limit.default(0),
  max_output_tokens_per_request: limit.default(0),
  is_default: z.boolean().default(false),
  model_ids: z.array(z.string().uuid()).optional(),
  feature_ids: z.array(z.string().uuid()).optional(),
});

export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).nullable().optional(),
    allow_all_models: z.boolean().optional(),
    limit_5h_tokens: limit.optional(),
    limit_weekly_tokens: limit.optional(),
    limit_rpm: limit.optional(),
    max_output_tokens_per_request: limit.optional(),
    is_default: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const profileModelsSchema = z.object({
  allow_all_models: z.boolean(),
  model_ids: z.array(z.string().uuid()),
});

export const profileFeaturesSchema = z.object({
  feature_ids: z.array(z.string().uuid()),
});
