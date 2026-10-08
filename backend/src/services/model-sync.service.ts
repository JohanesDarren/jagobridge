import { AppError } from "../core/errors.js";
import { logger } from "../core/logger.js";
import {
  getLastSuccessfulSyncAt,
  markModelsUnavailable,
  upsertModelsFromSync,
  type ModelCapabilities,
} from "../repositories/model.repository.js";
import { listUpstreamModels, type UpstreamModel } from "../gateway/upstream-client.js";
import { recordAudit } from "./audit.service.js";
import { invalidateAllAccessCaches } from "./access.service.js";
import type { RequestMeta } from "./auth.service.js";

export interface SyncResult {
  added: number;
  updated: number;
  marked_unavailable: number;
  duration_ms: number;
  synced_at: string;
}

function extractCapabilities(model: UpstreamModel): ModelCapabilities {
  const capabilities: ModelCapabilities = {};
  if (model.capabilities) {
    if (typeof model.capabilities.tool_calling === "boolean") {
      capabilities.tool_calling = model.capabilities.tool_calling;
    }
    if (typeof model.capabilities.vision_input === "boolean") {
      capabilities.vision_input = model.capabilities.vision_input;
    }
    if (typeof model.capabilities.json_mode === "boolean") {
      capabilities.json_mode = model.capabilities.json_mode;
    }
    if (typeof model.capabilities.context_length === "number") {
      capabilities.context_length = model.capabilities.context_length;
    }
  }
  return capabilities;
}

/**
 * Pulls the model list from 9router and reconciles the catalog:
 * new models start disabled, models missing upstream become unavailable.
 * On failure the last good catalog stays active (PRD F-05).
 */
export async function syncModels(actorId: string | null, meta: RequestMeta): Promise<SyncResult> {
  const startedAt = Date.now();
  let upstream;
  try {
    upstream = await listUpstreamModels();
  } catch (error) {
    logger.error({ err: error }, "model_sync_unreachable");
    throw new AppError(502, "SYNC_FAILED", "Model sync could not reach 9router");
  }

  if (!upstream.ok) {
    logger.error({ status: upstream.status }, "model_sync_upstream_error");
    throw new AppError(502, "SYNC_FAILED", `9router returned HTTP ${upstream.status}`);
  }

  const models = upstream.data?.data ?? [];
  const inputs = models.map((model) => ({
    upstream_id: model.id,
    display_name: model.id,
    provider_label: model.owned_by ?? null,
    capabilities: extractCapabilities(model),
  }));

  const { added, updated } = await upsertModelsFromSync(inputs);
  const markedUnavailable = await markModelsUnavailable(models.map((model) => model.id));
  await invalidateAllAccessCaches();

  const syncedAt = await getLastSuccessfulSyncAt();
  const result: SyncResult = {
    added,
    updated,
    marked_unavailable: markedUnavailable,
    duration_ms: Date.now() - startedAt,
    synced_at: (syncedAt ?? new Date()).toISOString(),
  };

  logger.info(result, "model_sync_completed");
  await recordAudit({
    actorUserId: actorId,
    action: "model.sync",
    targetType: "model",
    targetId: null,
    afterState: result as unknown as Record<string, unknown>,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return result;
}

export async function getSyncStatus(): Promise<{ last_successful_sync_at: string | null }> {
  const last = await getLastSuccessfulSyncAt();
  return { last_successful_sync_at: last ? last.toISOString() : null };
}
