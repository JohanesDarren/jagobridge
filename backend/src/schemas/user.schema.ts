import { z } from "zod";

const nullableNonNegativeInt = z.number().int().min(0).nullable();
const nullableNonNegativeBigInt = z.number().int().min(0).nullable();

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(255).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  role: z.enum(["admin", "member"]).optional(),
  profile_id: z.string().uuid().optional(),
});

export const updateUserSchema = z
  .object({
    access_profile_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
    name: z.string().min(1).max(100).optional(),
    role: z.enum(["admin", "member"]).optional(),
    limit_5h_tokens_override: nullableNonNegativeBigInt.optional(),
    limit_weekly_tokens_override: nullableNonNegativeBigInt.optional(),
    limit_rpm_override: nullableNonNegativeInt.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const inviteUserSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(["admin", "member"]).default("member"),
  access_profile_id: z.string().uuid(),
});

export const modelAccessSchema = z.object({
  overrides: z.array(
    z.object({
      model_id: z.string().uuid(),
      effect: z.enum(["allow", "deny"]),
    }),
  ),
});

export const featureAccessSchema = z.object({
  overrides: z.array(
    z.object({
      feature_id: z.string().uuid(),
      effect: z.enum(["allow", "deny"]),
    }),
  ),
});
