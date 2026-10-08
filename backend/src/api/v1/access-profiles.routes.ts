import { Router } from "express";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../schemas/validate.js";
import { successResponse } from "../../schemas/response.js";
import {
  createProfileSchema,
  profileFeaturesSchema,
  profileModelsSchema,
  updateProfileSchema,
} from "../../schemas/profile.schema.js";
import {
  createProfileService,
  deleteProfileService,
  getProfileDetail,
  listProfilesDto,
  listSelectableModels,
  setProfileFeaturesService,
  setProfileModelsService,
  updateProfileService,
} from "../../services/profile.service.js";
import { setProfileFeatures, setProfileModels } from "../../repositories/access-profile.repository.js";

export const accessProfilesRouter = Router();

accessProfilesRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const profiles = await listProfilesDto();
    res.status(200).json(successResponse(profiles, "Access profiles retrieved"));
  }),
);

accessProfilesRouter.get(
  "/models",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const models = await listSelectableModels();
    res.status(200).json(successResponse(models, "Models retrieved"));
  }),
);

accessProfilesRouter.post(
  "/",
  requireAuth,
  requireAdmin,
  validateBody(createProfileSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown> & {
      model_ids?: string[];
      feature_ids?: string[];
    };
    const profile = await createProfileService(body as never, req.authUser!.id, requestMeta(req));
    if (body.model_ids) {
      await setProfileModels(profile.id, body.model_ids, req.authUser!.id);
    }
    if (body.feature_ids) {
      await setProfileFeatures(profile.id, body.feature_ids, req.authUser!.id);
    }
    const detail = await getProfileDetail(profile.id);
    res.status(201).json(successResponse(detail, "Access profile created"));
  }),
);

accessProfilesRouter.get(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const profile = await getProfileDetail(req.params.id!);
    res.status(200).json(successResponse(profile, "Access profile retrieved"));
  }),
);

accessProfilesRouter.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const profile = await updateProfileService(req.params.id!, req.body, req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(profile, "Access profile updated"));
  }),
);

accessProfilesRouter.put(
  "/:id/models",
  requireAuth,
  requireAdmin,
  validateBody(profileModelsSchema),
  asyncHandler(async (req, res) => {
    const { allow_all_models, model_ids } = req.body as { allow_all_models: boolean; model_ids: string[] };
    const profile = await setProfileModelsService(
      req.params.id!,
      allow_all_models,
      model_ids,
      req.authUser!.id,
      requestMeta(req),
    );
    res.status(200).json(successResponse(profile, "Profile models updated"));
  }),
);

accessProfilesRouter.put(
  "/:id/features",
  requireAuth,
  requireAdmin,
  validateBody(profileFeaturesSchema),
  asyncHandler(async (req, res) => {
    const { feature_ids } = req.body as { feature_ids: string[] };
    const profile = await setProfileFeaturesService(
      req.params.id!,
      feature_ids,
      req.authUser!.id,
      requestMeta(req),
    );
    res.status(200).json(successResponse(profile, "Profile features updated"));
  }),
);

accessProfilesRouter.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteProfileService(req.params.id!, req.authUser!.id, requestMeta(req));
    res.status(200).json(successResponse(null, "Access profile deleted"));
  }),
);
