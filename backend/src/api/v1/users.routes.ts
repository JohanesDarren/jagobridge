import { Router } from "express";
import { AppError } from "../../core/errors.js";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../schemas/validate.js";
import { paginatedResponse, parsePagination, successResponse } from "../../schemas/response.js";
import {
  featureAccessSchema,
  inviteUserSchema,
  listUsersQuerySchema,
  modelAccessSchema,
  updateUserSchema,
} from "../../schemas/user.schema.js";
import {
  deleteUser,
  getUserDetail,
  listUsersDto,
  resetUserPassword,
  toUserDto,
  updateUserByAdmin,
} from "../../services/user.service.js";
import {
  inviteUser,
  listPendingInvitationsDto,
  resendInvitation,
  revokeInvitationService,
} from "../../services/invitation.service.js";
import { resolveEffectiveAccess, invalidateAccessCache } from "../../services/access.service.js";
import { getQuotaSnapshot, type WindowUsage } from "../../services/usage.service.js";
import { replaceUserFeatureOverrides, replaceUserModelOverrides } from "../../repositories/model.repository.js";
import { recordAudit } from "../../services/audit.service.js";

export const usersRouter = Router();

function windowDto(window: WindowUsage) {
  return {
    used_tokens: window.usedTokens,
    limit_tokens: window.limitTokens,
    remaining_tokens: window.remainingTokens,
    reset_at: window.resetAt ? window.resetAt.toISOString() : null,
    state: window.state,
  };
}

/** Own profile, effective access, and quota summary (PRD GET /users/me). */
usersRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.authUser!;
    const access = await resolveEffectiveAccess(user);
    const quota = await getQuotaSnapshot(user.id, access.limits);
    const { findProfileById } = await import("../../repositories/access-profile.repository.js");
    const profile = user.access_profile_id ? await findProfileById(user.access_profile_id) : undefined;
    res.status(200).json(
      successResponse(
        {
          user: toUserDto(user, profile?.name ?? null),
          limits: {
            limit_5h_tokens: access.limits.limit5hTokens,
            limit_weekly_tokens: access.limits.limitWeeklyTokens,
            limit_rpm: access.limits.limitRpm,
            max_output_tokens_per_request: access.limits.maxOutputTokensPerRequest,
          },
          features: access.allowedFeatureCodes,
          windows: {
            five_hour: windowDto(quota.fiveHour),
            weekly: windowDto(quota.weekly),
          },
        },
        "Profile retrieved",
      ),
    );
  }),
);

usersRouter.patch(
  "/me/usage-notice",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { updateUser } = await import("../../repositories/user.repository.js");
    await updateUser(req.authUser!.id, { usage_notice_acknowledged: true, updated_at: new Date() });
    res.status(200).json(successResponse(null, "Usage notice acknowledged"));
  }),
);

// ------------------------------------------------------------------ invitations
usersRouter.get(
  "/invitations",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const invitations = await listPendingInvitationsDto();
    res.status(200).json(successResponse(invitations, "Invitations retrieved"));
  }),
);

usersRouter.post(
  "/invitations",
  requireAuth,
  requireAdmin,
  validateBody(inviteUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { email: string; role: "admin" | "member"; access_profile_id: string };
    const invitation = await inviteUser(
      { email: body.email, role: body.role, accessProfileId: body.access_profile_id },
      req.authUser!.id,
      requestMeta(req),
    );
    res.status(201).json(successResponse(invitation, "Invitation created"));
  }),
);

usersRouter.post(
  "/invitations/:id/resend",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const invitation = await resendInvitation(req.params.id!, req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(invitation, "Invitation resent"));
  }),
);

usersRouter.delete(
  "/invitations/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await revokeInvitationService(req.params.id!, req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(null, "Invitation revoked"));
  }),
);

// ----------------------------------------------------------------------- list
usersRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const query = listUsersQuerySchema.parse(req.query);
    const pagination = parsePagination(query);
    const { users, total } = await listUsersDto(
      {
        search: query.search,
        status: query.status,
        role: query.role,
        profileId: query.profile_id,
      },
      pagination,
    );
    res
      .status(200)
      .json(paginatedResponse(users, { total, page: pagination.page, limit: pagination.limit }));
  }),
);

usersRouter.get(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const detail = await getUserDetail(req.params.id!);
    res.status(200).json(successResponse(detail, "User retrieved"));
  }),
);

usersRouter.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await updateUserByAdmin(req.params.id!, req.body, req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(user, "User updated"));
  }),
);

usersRouter.put(
  "/:id/model-access",
  requireAuth,
  requireAdmin,
  validateBody(modelAccessSchema),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id!;
    const { overrides } = req.body as { overrides: Array<{ model_id: string; effect: "allow" | "deny" }> };
    const user = await getUserDetail(targetId);
    await replaceUserModelOverrides(
      targetId,
      overrides.map((override) => ({ modelId: override.model_id, effect: override.effect })),
      req.authUser!.id,
    );
    await invalidateAccessCache(targetId);
    await recordAudit({
      actorUserId: req.authUser!.id,
      action: "user.model_access_update",
      targetType: "user",
      targetId,
      afterState: { count: overrides.length },
      ipAddress: requestMeta(req).ip,
      userAgent: requestMeta(req).userAgent,
    });
    res.status(200).json(successResponse(user, "Model access updated"));
  }),
);

usersRouter.put(
  "/:id/feature-access",
  requireAuth,
  requireAdmin,
  validateBody(featureAccessSchema),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id!;
    const { overrides } = req.body as { overrides: Array<{ feature_id: string; effect: "allow" | "deny" }> };
    await replaceUserFeatureOverrides(
      targetId,
      overrides.map((override) => ({ featureId: override.feature_id, effect: override.effect })),
      req.authUser!.id,
    );
    await invalidateAccessCache(targetId);
    await recordAudit({
      actorUserId: req.authUser!.id,
      action: "user.feature_access_update",
      targetType: "user",
      targetId,
      afterState: { count: overrides.length },
      ipAddress: requestMeta(req).ip,
      userAgent: requestMeta(req).userAgent,
    });
    const detail = await getUserDetail(targetId);
    res.status(200).json(successResponse(detail, "Feature access updated"));
  }),
);

usersRouter.post(
  "/:id/reset-password",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await resetUserPassword(req.params.id!, req.authUser!.id, requestMeta(req));
    res.status(200).json(
      successResponse(
        result,
        "Temporary password generated. Copy it now; it will not be shown again.",
      ),
    );
  }),
);

usersRouter.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!req.params.id) throw new AppError(400, "VALIDATION_ERROR", "User id is required");
    await deleteUser(req.params.id, req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(null, "User deleted"));
  }),
);
