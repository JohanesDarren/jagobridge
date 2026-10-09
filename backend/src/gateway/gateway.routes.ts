import { Router, type Response } from "express";
import { loadEnv } from "../core/env.js";
import { logger } from "../core/logger.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { gatewayAuth } from "../middleware/api-key.js";
import { validateBody } from "../schemas/validate.js";
import { chatCompletionSchema } from "../schemas/gateway.schema.js";
import { listAvailableEnabledModels } from "../repositories/model.repository.js";
import type { UserRow } from "../repositories/user.repository.js";
import { canUseModel, resolveEffectiveAccess } from "../services/access.service.js";
import {
  estimatePromptTokens,
  recordGatewayUsage,
  runGatewayPipeline,
  type PipelineSuccess,
} from "./pipeline.js";
import { openAiError, sendGatewayError } from "./openai-errors.js";
import { setGatewayHeaders } from "./headers.js";
import { forwardChatCompletion, upstreamTimeoutConfig } from "./upstream-client.js";

const env = loadEnv();
export const gatewayRouter = Router();

gatewayRouter.use(gatewayAuth);

type UpstreamResponse = Awaited<ReturnType<typeof forwardChatCompletion>>["response"];

interface RequestContext {
  user: UserRow;
  apiKeyId: string | null;
  requestId: string;
  startedAt: number;
}

/** GET /v1/models — models the caller can use, in OpenAI list format. */
gatewayRouter.get(
  "/models",
  asyncHandler(async (req, res) => {
    const access = await resolveEffectiveAccess(req.authUser!);
    const models = await listAvailableEnabledModels();
    const usable = models.filter((model) => canUseModel(access, model));
    res.status(200).json({
      object: "list",
      data: usable.map((model) => ({
        id: model.public_name,
        object: "model",
        created: Math.floor(new Date(model.created_at).getTime() / 1000),
        owned_by: model.provider_label ?? "9router",
      })),
    });
  }),
);

/** POST /v1/chat/completions — streaming and non-streaming. */
gatewayRouter.post(
  "/chat/completions",
  validateBody(chatCompletionSchema),
  asyncHandler(async (req, res) => {
    const ctx: RequestContext = {
      user: req.authUser!,
      apiKeyId: req.gatewayKey?.id ?? null,
      requestId: String(req.id),
      startedAt: Date.now(),
    };
    const body = req.body as Record<string, unknown>;

    const result = await runGatewayPipeline({
      user: ctx.user,
      source: "api",
      modelPublicName: String(body.model),
      body,
    });

    if (!result.ok) {
      if (result.rpm && result.snapshot) setGatewayHeaders(res, result.rpm, result.snapshot);
      sendGatewayError(res, result.error);
      return;
    }

    const streaming = body.stream === true;
    const controller = new AbortController();
    let clientCancelled = false;
    let settled = false;
    req.on("close", () => {
      if (!settled && streaming && !res.writableEnded) {
        clientCancelled = true;
        controller.abort();
      }
    });

    try {
      const timeout = upstreamTimeoutConfig();
      const forward = await forwardWithFirstByteTimeout(result, controller.signal, timeout.firstByteMs);

      if (forward === null) {
        await recordFailure(ctx, result, "upstream_error", 0, 0, false, null);
        await result.concurrency.release();
        settled = true;
        sendGatewayError(res, openAiError(504, "UPSTREAM_TIMEOUT", "9router did not respond in time"));
        return;
      }

      if (!forward.ok) {
        const upstreamError = await readUpstreamError(forward.response);
        await recordFailure(ctx, result, "upstream_error", 0, 0, false, upstreamError.status);
        await result.concurrency.release();
        settled = true;
        if (upstreamError.status >= 500) {
          sendGatewayError(
            res,
            openAiError(502, "UPSTREAM_ERROR", `9router returned HTTP ${upstreamError.status}`),
          );
        } else {
          res.status(upstreamError.status).json({
            error: {
              message: upstreamError.message,
              type: "invalid_request_error",
              code: upstreamError.code ?? "UPSTREAM_ERROR",
              param: null,
            },
          });
        }
        return;
      }

      setGatewayHeaders(res, result.rpm, result.snapshot);

      if (streaming) {
        await handleStreaming(res, result, forward.response, ctx, controller, () => clientCancelled);
      } else {
        await handleNonStreaming(res, result, forward.response, ctx);
      }
      settled = true;
    } catch (error) {
      await result.concurrency.release();
      settled = true;
      const aborted = error instanceof Error && error.name === "AbortError";
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      if (aborted && clientCancelled) return;
      sendGatewayError(
        res,
        aborted
          ? openAiError(504, "UPSTREAM_TIMEOUT", "9router timed out")
          : openAiError(502, "UPSTREAM_ERROR", "9router is unreachable"),
      );
    }
  }),
);

async function readUpstreamError(
  response: UpstreamResponse,
): Promise<{ status: number; message: string; code?: string }> {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } };
    return {
      status: response.status,
      message: parsed.error?.message ?? "Upstream request failed",
      code: parsed.error?.code,
    };
  } catch {
    return { status: response.status, message: text.slice(0, 300) || "Upstream request failed" };
  }
}

/**
 * Forwards with a first-byte timeout. Retries once on a connection error before
 * any bytes are sent (PRD F-09). Returns null on first-byte timeout.
 */
async function forwardWithFirstByteTimeout(
  result: PipelineSuccess,
  signal: AbortSignal,
  firstByteMs: number,
): Promise<Awaited<ReturnType<typeof forwardChatCompletion>> | null> {
  // Always send an explicit boolean: 9router defaults to streaming when `stream`
  // is omitted, which would break the non-streaming response path (PRD F-09).
  const body = { ...result.body };
  body.stream = body.stream === true;
  if (body.stream === true) {
    body.stream_options = { include_usage: true };
  }

  const attempt = async () => {
    let timer: NodeJS.Timeout | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(Object.assign(new Error("first byte timeout"), { name: "TimeoutError" })),
        firstByteMs,
      );
    });
    try {
      return await Promise.race([forwardChatCompletion(body, signal), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError") throw error;
    if (name === "TimeoutError") return null;
    return await attempt();
  }
}

async function recordFailure(
  ctx: RequestContext,
  result: PipelineSuccess,
  status: "upstream_error" | "client_cancelled",
  promptTokens: number,
  completionTokens: number,
  estimated: boolean,
  upstreamStatus: number | null = null,
): Promise<void> {
  await recordGatewayUsage({
    requestId: ctx.requestId,
    user: ctx.user,
    apiKeyId: ctx.apiKeyId,
    model: result.model,
    source: "api",
    status,
    promptTokens,
    completionTokens,
    usageEstimated: estimated,
    latencyMs: Date.now() - ctx.startedAt,
    upstreamStatus,
  });
}

async function handleNonStreaming(
  res: Response,
  result: PipelineSuccess,
  upstream: UpstreamResponse,
  ctx: RequestContext,
): Promise<void> {
  const json = (await upstream.json()) as {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
    [key: string]: unknown;
  };
  const promptTokens = json.usage?.prompt_tokens ?? estimatePromptTokens(result.body);
  const completionTokens = json.usage?.completion_tokens ?? 0;
  const cachedTokens = json.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const estimated = json.usage === undefined;

  await recordGatewayUsage({
    requestId: ctx.requestId,
    user: ctx.user,
    apiKeyId: ctx.apiKeyId,
    model: result.model,
    source: "api",
    status: "success",
    promptTokens,
    completionTokens,
    cachedTokens,
    usageEstimated: estimated,
    latencyMs: Date.now() - ctx.startedAt,
    upstreamStatus: upstream.status,
  });
  await result.concurrency.release();

  res.status(200).json({ ...json, model: result.model.public_name });
}

async function handleStreaming(
  res: Response,
  result: PipelineSuccess,
  upstream: UpstreamResponse,
  ctx: RequestContext,
  controller: AbortController,
  wasClientCancelled: () => boolean,
): Promise<void> {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const reader = upstream.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completionTokens = 0;
  let cachedTokens = 0;
  let estimatedCompletionChars = 0;
  let promptTokens: number | null = null;
  let streamUsageSeen = false;
  let finished = false;

  if (!reader) {
    await recordFailure(ctx, result, "upstream_error", estimatePromptTokens(result.body), 0, true, upstream.status);
    await result.concurrency.release();
    res.end();
    return;
  }

  let idleTimer: NodeJS.Timeout | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), env.UPSTREAM_STREAM_IDLE_TIMEOUT_SECONDS * 1000);
  };

  try {
    resetIdle();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);

      buffer += chunk;
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              prompt_tokens_details?: { cached_tokens?: number };
            };
            choices?: Array<{ delta?: { content?: string } }>;
          };
          if (parsed.usage) {
            streamUsageSeen = true;
            promptTokens = parsed.usage.prompt_tokens ?? promptTokens;
            completionTokens = parsed.usage.completion_tokens ?? completionTokens;
            cachedTokens = parsed.usage.prompt_tokens_details?.cached_tokens ?? cachedTokens;
          }
          const text = parsed.choices?.[0]?.delta?.content;
          if (typeof text === "string") estimatedCompletionChars += text.length;
        } catch {
          // ignore non-JSON frames
        }
      }
    }
    finished = true;
  } catch (error) {
    logger.warn(
      { aborted: error instanceof Error && error.name === "AbortError" },
      "gateway_stream_interrupted",
    );
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }

  const cancelled = wasClientCancelled() || (!finished && !streamUsageSeen);
  const finalPrompt = promptTokens ?? estimatePromptTokens(result.body);
  const finalCompletion = streamUsageSeen ? completionTokens : Math.ceil(estimatedCompletionChars / 4);

  await recordGatewayUsage({
    requestId: ctx.requestId,
    user: ctx.user,
    apiKeyId: ctx.apiKeyId,
    model: result.model,
    source: "api",
    status: cancelled ? "client_cancelled" : "success",
    promptTokens: finalPrompt,
    completionTokens: finalCompletion,
    cachedTokens,
    usageEstimated: !streamUsageSeen,
    latencyMs: Date.now() - ctx.startedAt,
    upstreamStatus: upstream.status,
  });
  await result.concurrency.release();

  if (!res.writableEnded) res.end();
}
