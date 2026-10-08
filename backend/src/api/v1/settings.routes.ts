import { Router } from "express";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../schemas/validate.js";
import { successResponse } from "../../schemas/response.js";
import { updateSettingsSchema } from "../../schemas/settings.schema.js";
import {
  getSettingsDto,
  testUpstreamConnection,
  updateSettings,
} from "../../services/settings.service.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const settings = await getSettingsDto();
    res.status(200).json(successResponse(settings, "Settings retrieved"));
  }),
);

settingsRouter.patch(
  "/",
  requireAuth,
  requireAdmin,
  validateBody(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await updateSettings(req.body, req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(settings, "Settings updated"));
  }),
);

settingsRouter.post(
  "/test-upstream",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await testUpstreamConnection();
    res.status(200).json(successResponse(result, result.message));
  }),
);
