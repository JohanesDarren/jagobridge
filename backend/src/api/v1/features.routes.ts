import { Router } from "express";
import { AppError } from "../../core/errors.js";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { successResponse } from "../../schemas/response.js";
import { findFeatureById, listFeatures, setFeatureEnabled } from "../../repositories/feature.repository.js";
import { invalidateAllAccessCaches } from "../../services/access.service.js";
import { recordAudit } from "../../services/audit.service.js";

export const featuresRouter = Router();

featuresRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const features = await listFeatures();
    res.status(200).json(
      successResponse(
        features.map((feature) => ({
          id: feature.id,
          code: feature.code,
          name: feature.name,
          description: feature.description,
          is_enabled: feature.is_enabled,
        })),
        "Feature catalog retrieved",
      ),
    );
  }),
);

featuresRouter.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    const feature = await findFeatureById(id);
    if (!feature) throw new AppError(404, "NOT_FOUND", "Feature not found");

    const isEnabled = (req.body as { is_enabled?: boolean }).is_enabled;
    if (typeof isEnabled !== "boolean") {
      throw new AppError(400, "VALIDATION_ERROR", "is_enabled must be a boolean", {
        is_enabled: ["Required boolean"],
      });
    }

    const updated = await setFeatureEnabled(id, isEnabled, req.authUser!.id);
    await invalidateAllAccessCaches();
    await recordAudit({
      actorUserId: req.authUser!.id,
      action: "feature.update",
      targetType: "feature",
      targetId: id,
      beforeState: { is_enabled: feature.is_enabled },
      afterState: { is_enabled: isEnabled },
      ipAddress: requestMeta(req).ip,
      userAgent: requestMeta(req).userAgent,
    });

    res.status(200).json(
      successResponse(
        {
          id: updated!.id,
          code: updated!.code,
          name: updated!.name,
          description: updated!.description,
          is_enabled: updated!.is_enabled,
        },
        "Feature updated",
      ),
    );
  }),
);
