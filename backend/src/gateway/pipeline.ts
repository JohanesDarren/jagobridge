import { loadEnv } from "../core/env.js";
import type { FeatureCode, UsageSource, UsageStatus } from "../core/constants.js";
import { logger } from "../core/logger.js";
import {
  canUseFeature,
  canUseModel,
  isModelFeatureSupported,
  resolveEffectiveAccess,
  type EffectiveAccess,
} from "../services/access.service.js";
import { checkAdmission, recordUsage, type QuotaSnapshot } from "../services/usage.service.js";
import { acquireConcurrency, checkRpm, type ConcurrencyHandle, type RpmCheckResult } from "../services/rate-limit.service.js";
import { findModelByPublicName, type ModelRow } from "../repositories/model.repository.js";
import type { UserRow } from "../repositories/user.repository.js";
import { openAiError } from "./openai-errors.js";
import type { GatewayError } from "../core/errors.js";
import { getMaxInflightRequestsPerUser } from "../services/settings.service.js";

const env = loadEnv();

export type PipelineFailure = {
  ok: false;
  error: GatewayError;
  rpm?: RpmCheckResult;
  snapshot?: QuotaSnapshot;
};

export interface PipelineSuccess {
  ok: true;
  model: ModelRow;
  access: EffectiveAccess;
  detectedFeatures: FeatureCode[];
  body: Record<string, unknown>;
  rpm: RpmCheckResult;
  snapshot: QuotaSnapshot;
  concurrency: ConcurrencyHandle;
}

export type PipelineResult = PipelineSuccess | PipelineFailure;

export interface PipelineInput {
  user: UserRow;
  source: UsageSource;
  modelPublicName: string;
  body: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Feature detection (PRD F-07 table)
// ---------------------------------------------------------------------------

interface ChatMessage {
  role?: string;
  content?: unknown;
}

export function detectFeatures(body: Record<string, unknown>): FeatureCode[] {
  const features: FeatureCode[] = [];
  if (body.stream === true) features.push("streaming");

  const tools = body.tools;
  const functions = body.functions;
  if ((Array.isArray(tools) && tools.length > 0) || (Array.isArray(functions) && functions.length > 0)) {
    features.push("tool_calling");
  }

  const responseFormat = body.response_format as { type?: string } | undefined;
  if (
    responseFormat &&
    (responseFormat.type === "json_object" || responseFormat.type === "json_schema")
  ) {
    features.push("json_mode");
  }

  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const hasImage = messages.some(
    (message) =>
      Array.isArray(message.content) &&
      (message.content as Array<{ type?: string }>).some((part) => part?.type === "image_url"),
  );
  if (hasImage) features.push("vision_input");

  return features;
}

/** Counts characters across message content, used for the token estimate fallback. */
export function countMessageCharacters(body: Record<string, unknown>): number {
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  let total = 0;
  for (const message of messages) {
    if (typeof message.content === "string") total += message.content.length;
    else if (Array.isArray(message.content)) {
      for (const part of message.content as Array<{ type?: string; text?: string }>) {
        if (part?.type === "text" && typeof part.text === "string") total += part.text.length;
      }
    }
  }
  return total;
}

export function estimatePromptTokens(body: Record<string, unknown>): number {
  return Math.ceil(countMessageCharacters(body) / 4);
}

// ---------------------------------------------------------------------------
// Admission pipeline: steps 2-7 (PRD F-09)
// ---------------------------------------------------------------------------

/**
 * Runs model access, feature entitlement, capability, RPM, concurrency, and
 * usage admission checks in the documented order. On success the caller owns the
 * concurrency handle and MUST release it after the request settles.
 */
export async function runGatewayPipeline(input: PipelineInput): Promise<PipelineResult> {
  if (!env.GATEWAY_ENABLED) {
    return { ok: false, error: openAiError(503, "INTERNAL_ERROR", "The gateway is temporarily disabled") };
  }

  // Step 2: user active
  if (!input.user.is_active) {
    return { ok: false, error: openAiError(403, "USER_INACTIVE", "Your account is deactivated") };
  }

  // Step 3: model resolution
  const model = await findModelByPublicName(input.modelPublicName);
  if (!model) {
    return {
      ok: false,
      error: openAiError(404, "MODEL_NOT_FOUND", `The model '${input.modelPublicName}' was not found`),
    };
  }

  const access = await resolveEffectiveAccess(input.user);

  // Step 4: model access
  if (!canUseModel(access, model)) {
    // A disabled/unavailable model is reported as not found (PRD F-06).
    if (!model.is_enabled || !model.is_available) {
      return {
        ok: false,
        error: openAiError(404, "MODEL_NOT_FOUND", `The model '${input.modelPublicName}' is not available`),
      };
    }
    return {
      ok: false,
      error: openAiError(403, "MODEL_NOT_ALLOWED", `You are not allowed to use '${input.modelPublicName}'`),
    };
  }

  // Step 5: feature entitlement and model capability
  const detectedFeatures = detectFeatures(input.body);
  for (const feature of detectedFeatures) {
    if (!canUseFeature(access, feature)) {
      return {
        ok: false,
        error: openAiError(
          403,
          "FEATURE_NOT_ENTITLED",
          `You are not entitled to the '${feature}' feature`,
        ),
      };
    }
    if (!isModelFeatureSupported(model, feature)) {
      return {
        ok: false,
        error: openAiError(
          422,
          "MODEL_CAPABILITY_NOT_SUPPORTED",
          `The model '${model.public_name}' does not support '${feature}'`,
        ),
      };
    }
  }

  // Step 6: RPM and concurrency
  const rpm = await checkRpm(input.user.id, access.limits.limitRpm);
  if (!rpm.allowed) {
    return {
      ok: false,
      error: openAiError(429, "RATE_LIMIT_EXCEEDED", "Requests per minute limit reached", 60),
      rpm,
    };
  }

  const maxInflight = await getMaxInflightRequestsPerUser();
  const concurrency = await acquireConcurrency(input.user.id, maxInflight);
  if (!concurrency.acquired) {
    return {
      ok: false,
      error: openAiError(
        429,
        "CONCURRENCY_LIMIT_EXCEEDED",
        `Too many requests in flight. The limit is ${maxInflight}.`,
        5,
      ),
    };
  }

  // Step 7: usage admission
  let admission;
  try {
    admission = await checkAdmission(input.user.id, access.limits);
  } catch (error) {
    await concurrency.release();
    throw error;
  }

  if (!admission.admitted) {
    await concurrency.release();
    const isFiveHour = admission.window === "five_hour";
    const message = isFiveHour
      ? `Usage limit reached for the last 5 hours. Try again in ${admission.retryAfterSeconds} seconds.`
      : `Weekly usage limit reached. Try again in ${admission.retryAfterSeconds} seconds.`;
    return {
      ok: false,
      error: openAiError(
        429,
        isFiveHour ? "USAGE_LIMIT_5H_EXCEEDED" : "USAGE_LIMIT_WEEKLY_EXCEEDED",
        message,
        admission.retryAfterSeconds,
      ),
      rpm,
      snapshot: admission.snapshot,
    };
  }

  // Step 8 prep: translate the model to upstream_id and clamp max output tokens.
  const body = { ...input.body };
  body.model = model.upstream_id;

  const cap = access.limits.maxOutputTokensPerRequest;
  if (cap > 0) {
    for (const key of ["max_tokens", "max_completion_tokens"]) {
      const value = body[key];
      if (typeof value === "number" && value > cap) {
        body[key] = cap;
        logger.warn({ model: model.public_name, requested: value, capped: cap }, "max_tokens_lowered");
      }
    }
  }

  return {
    ok: true,
    model,
    access,
    detectedFeatures,
    body,
    rpm,
    snapshot: admission.snapshot,
    concurrency,
  };
}

export interface RecordGatewayUsageInput {
  requestId: string;
  user: UserRow;
  apiKeyId: string | null;
  model: ModelRow;
  source: UsageSource;
  status: UsageStatus;
  promptTokens: number;
  completionTokens: number;
  /** Prompt tokens served from the upstream prompt cache (defaults to 0). */
  cachedTokens?: number;
  usageEstimated: boolean;
  latencyMs: number | null;
  /** HTTP status returned by 9router; null when no response was received. */
  upstreamStatus?: number | null;
}

/** Step 9: records a usage event with the model's multiplier snapshotted. */
export async function recordGatewayUsage(input: RecordGatewayUsageInput): Promise<void> {
  try {
    await recordUsage({
      requestId: input.requestId,
      userId: input.user.id,
      apiKeyId: input.apiKeyId,
      modelId: input.model.id,
      modelPublicName: input.model.public_name,
      source: input.source,
      status: input.status,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      cachedTokens: input.cachedTokens ?? 0,
      tokenMultiplier: Number(input.model.token_multiplier),
      usageEstimated: input.usageEstimated,
      latencyMs: input.latencyMs,
      upstreamStatus: input.upstreamStatus ?? null,
    });
  } catch (error) {
    logger.error({ err: error, requestId: input.requestId }, "usage_record_failed");
  }
}
