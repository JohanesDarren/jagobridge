import { Router } from "express";
import { AppError } from "../../core/errors.js";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../schemas/validate.js";
import { successResponse } from "../../schemas/response.js";
import { createApiKeySchema, listApiKeysQuerySchema } from "../../schemas/api-key.schema.js";
import {
  createApiKeyService,
  listApiKeys,
  revokeApiKeyService,
} from "../../services/api-key.service.js";

export const apiKeysRouter = Router();

apiKeysRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { user_id } = listApiKeysQuerySchema.parse(req.query);
    const caller = req.authUser!;
    if (user_id && user_id !== caller.id && caller.role !== "admin") {
      throw new AppError(403, "FORBIDDEN", "You cannot view another user's API keys");
    }
    const targetUserId = user_id ?? caller.id;
    const keys = await listApiKeys(targetUserId);
    res.status(200).json(successResponse(keys, "API keys retrieved"));
  }),
);

apiKeysRouter.post(
  "/",
  requireAuth,
  validateBody(createApiKeySchema),
  asyncHandler(async (req, res) => {
    const { name, expires_at } = req.body as { name: string; expires_at?: string | null };
    const created = await createApiKeyService(req.authUser!.id, name, expires_at ?? null, requestMeta(req));
    res.status(201).json(
      successResponse(created, "API key created. Copy it now. It will not be shown again."),
    );
  }),
);

apiKeysRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const caller = req.authUser!;
    await revokeApiKeyService(req.params.id!, caller.id, caller.role === "admin", requestMeta(req));
    res.status(200).json(successResponse(null, "API key revoked"));
  }),
);
