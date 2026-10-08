import { Router } from "express";
import { AppError } from "../../core/errors.js";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../schemas/validate.js";
import { successResponse } from "../../schemas/response.js";
import { updateModelSchema } from "../../schemas/model.schema.js";
import {
  findModelById,
  listAvailableEnabledModels,
  listModels,
  updateModel,
  type ModelRow,
} from "../../repositories/model.repository.js";
import { canUseModel, invalidateAllAccessCaches, resolveEffectiveAccess } from "../../services/access.service.js";
import { getSyncStatus, syncModels } from "../../services/model-sync.service.js";
import { recordAudit } from "../../services/audit.service.js";

export const modelsRouter = Router();

function toModelDto(model: ModelRow) {
  return {
    id: model.id,
    upstream_id: model.upstream_id,
    public_name: model.public_name,
    display_name: model.display_name,
    provider_label: model.provider_label,
    capabilities: model.capabilities,
    token_multiplier: Number(model.token_multiplier),
    is_enabled: model.is_enabled,
    is_available: model.is_available,
    last_synced_at: model.last_synced_at ? new Date(model.last_synced_at).toISOString() : null,
    created_at: model.created_at.toISOString(),
    updated_at: model.updated_at.toISOString(),
  };
}

/** Full catalog with settings (admin). */
modelsRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : undefined;
    const enabledFilter = req.query.enabled;
    let models = await listModels();
    if (search) {
      models = models.filter(
        (model) =>
          model.public_name.toLowerCase().includes(search) ||
          model.display_name.toLowerCase().includes(search) ||
          model.upstream_id.toLowerCase().includes(search),
      );
    }
    if (enabledFilter === "true") models = models.filter((model) => model.is_enabled);
    if (enabledFilter === "false") models = models.filter((model) => !model.is_enabled);
    const status = await getSyncStatus();
    res.status(200).json(
      successResponse({ models: models.map(toModelDto), sync: status }, "Models retrieved"),
    );
  }),
);

/** Models the caller can use (all roles). */
modelsRouter.get(
  "/available",
  requireAuth,
  asyncHandler(async (req, res) => {
    const access = await resolveEffectiveAccess(req.authUser!);
    const models = await listAvailableEnabledModels();
    const usable = models.filter((model) => canUseModel(access, model)).map(toModelDto);
    res.status(200).json(successResponse(usable, "Available models retrieved"));
  }),
);

modelsRouter.post(
  "/sync",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await syncModels(req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(result, "Model sync completed"));
  }),
);

modelsRouter.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateBody(updateModelSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    const model = await findModelById(id);
    if (!model) throw new AppError(404, "NOT_FOUND", "Model not found");

    const body = req.body as {
      public_name?: string;
      display_name?: string;
      token_multiplier?: number;
      is_enabled?: boolean;
      capabilities?: Record<string, unknown>;
    };

    if (body.public_name && body.public_name !== model.public_name) {
      const all = await listModels();
      if (all.some((item) => item.id !== id && item.public_name === body.public_name)) {
        throw new AppError(409, "VALIDATION_ERROR", "Public name must be unique", {
          public_name: ["This public name is already in use"],
        });
      }
    }

    const capabilities = body.capabilities
      ? { ...model.capabilities, ...body.capabilities }
      : undefined;

    const updated = await updateModel(id, {
      ...(body.public_name !== undefined ? { public_name: body.public_name } : {}),
      ...(body.display_name !== undefined ? { display_name: body.display_name } : {}),
      ...(body.token_multiplier !== undefined ? { token_multiplier: body.token_multiplier } : {}),
      ...(body.is_enabled !== undefined ? { is_enabled: body.is_enabled } : {}),
      ...(capabilities ? { capabilities: capabilities as ModelRow["capabilities"] } : {}),
      updated_by: req.authUser!.id,
    });

    await invalidateAllAccessCaches();
    await recordAudit({
      actorUserId: req.authUser!.id,
      action: "model.update",
      targetType: "model",
      targetId: id,
      beforeState: {
        public_name: model.public_name,
        is_enabled: model.is_enabled,
        token_multiplier: Number(model.token_multiplier),
      },
      afterState: {
        public_name: updated?.public_name,
        is_enabled: updated?.is_enabled,
        token_multiplier: updated ? Number(updated.token_multiplier) : undefined,
      },
      ipAddress: requestMeta(req).ip,
      userAgent: requestMeta(req).userAgent,
    });

    res.status(200).json(successResponse(toModelDto(updated!), "Model updated"));
  }),
);
