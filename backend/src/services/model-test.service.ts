import { logger } from "../core/logger.js";
import {
  MODEL_TEST_MAX_TOKENS,
  MODEL_TEST_PROMPT,
  MODEL_TEST_TIMEOUT_SECONDS,
  UPSTREAM_CHAT_COMPLETIONS_PATH,
} from "../core/constants.js";
import { isUpstreamConfigured } from "../gateway/upstream-client.js";
import { loadEnv } from "../core/env.js";
import type { ModelRow } from "../repositories/model.repository.js";

const env = loadEnv();

export interface ModelTestResult {
  /** True only when the upstream answered with a usable completion. */
  usable: boolean;
  /** HTTP status returned by 9router; 0 when the request never completed. */
  upstream_status: number;
  /** Round-trip time in milliseconds. */
  latency_ms: number;
  /** Human-readable verdict for the admin UI. */
  message: string;
  /** Short sample of the assistant text, when the model answered. */
  sample: string | null;
}

/**
 * Probes a single model with a minimal chat completion straight against 9router
 * (F-05 admin tooling). It uses the team upstream key — the same credential the
 * gateway uses — so it proves the model itself works, independent of any
 * member's access rules or quota. Because it bypasses the gateway pipeline, the
 * probe is NOT recorded as usage and does not consume anyone's limits.
 */
export async function testModel(model: ModelRow): Promise<ModelTestResult> {
  if (!isUpstreamConfigured()) {
    return {
      usable: false,
      upstream_status: 0,
      latency_ms: 0,
      message: "Upstream base URL or API key is not configured",
      sample: null,
    };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TEST_TIMEOUT_SECONDS * 1000);

  try {
    const response = await fetch(
      `${env.UPSTREAM_BASE_URL.replace(/\/$/, "")}${UPSTREAM_CHAT_COMPLETIONS_PATH}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTREAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.upstream_id,
          messages: [{ role: "user", content: MODEL_TEST_PROMPT }],
          max_tokens: MODEL_TEST_MAX_TOKENS,
        }),
        signal: controller.signal,
      },
    );
    const latencyMs = Date.now() - started;
    const text = await response.text().catch(() => "");

    if (!response.ok) {
      logger.warn(
        { model: model.public_name, status: response.status },
        "model_test_upstream_error",
      );
      return {
        usable: false,
        upstream_status: response.status,
        latency_ms: latencyMs,
        message: upstreamErrorMessage(response.status, text),
        sample: null,
      };
    }

    const sample = extractSample(text);
    return {
      usable: true,
      upstream_status: response.status,
      latency_ms: latencyMs,
      message: `Model responded in ${latencyMs} ms`,
      sample,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const aborted = error instanceof Error && error.name === "AbortError";
    logger.warn({ err: error, model: model.public_name }, "model_test_failed");
    return {
      usable: false,
      upstream_status: 0,
      latency_ms: latencyMs,
      message: aborted
        ? `No response within ${MODEL_TEST_TIMEOUT_SECONDS}s — the model may be overloaded or offline`
        : error instanceof Error
          ? error.message
          : "Upstream unreachable",
      sample: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Turns an upstream error body into a short, readable verdict. */
export function upstreamErrorMessage(status: number, body: string): string {
  const detail = deepestMessage(safeParse(body)) ?? plainTextBody(body);
  if (detail) return `Unusable — HTTP ${status}: ${detail.slice(0, 200)}`;
  if (status === 402) return "Unusable — HTTP 402: upstream account has no balance";
  if (status === 404) return "Unusable — HTTP 404: model not found upstream";
  if (status === 429) return "Unusable — HTTP 429: upstream rate limit reached";
  return `Unusable — upstream returned HTTP ${status}`;
}

/**
 * Falls back to the raw body when it is short, non-JSON text. Long bodies and
 * markup (HTML error pages) are ignored so the UI never shows a wall of noise.
 */
function plainTextBody(body: string): string | null {
  const text = body.trim();
  if (!text || text.length > 200) return null;
  if (text.startsWith("<") || text.startsWith("{")) return null;
  return text;
}

/**
 * Digs the most specific human message out of an upstream error body. 9router
 * nests a JSON error inside the `message` string — and truncates it, so the
 * braces never balance. We therefore pull the inner `"message"` value by regex
 * rather than trying to parse the fragment.
 */
function deepestMessage(payload: unknown, depth = 0): string | null {
  if (depth > 4 || payload === null || payload === undefined) return null;

  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text) return null;

    const inner =
      matchJsonStringValue(text, "message") ??
      matchJsonStringValue(text, "detail") ??
      matchJsonStringValue(text, "error_description");
    if (inner && inner !== text) {
      return deepestMessage(inner, depth + 1) ?? inner;
    }

    const embedded = extractEmbeddedJson(text);
    if (embedded) {
      const nested = deepestMessage(embedded, depth + 1);
      if (nested) return nested;
    }

    return stripProviderPrefix(text);
  }

  if (typeof payload === "object") {
    const shape = payload as Record<string, unknown>;
    for (const key of ["message", "detail", "reason", "error_description", "error"]) {
      const found = deepestMessage(shape[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Reads a `"key":"value"` pair out of a string, unescaping the value. */
function matchJsonStringValue(text: string, key: string): string | null {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
  const captured = match?.[1];
  if (!captured) return null;
  try {
    return JSON.parse(`"${captured}"`) as string;
  } catch {
    return captured;
  }
}

/** Drops a leading "[provider/model] [status]:" prefix for readability. */
function stripProviderPrefix(text: string): string {
  return text.replace(/^\[[^\]]*\]\s*\[\d+\]\s*:?\s*/, "").trim() || text;
}

/** Extracts the first JSON object embedded in a string, if any. */
function extractEmbeddedJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Best-effort assistant text from a buffered chat completion response. */
function extractSample(text: string): string | null {
  const parsed = safeParse(text) as {
    choices?: Array<{ message?: { content?: unknown; reasoning?: unknown } }>;
  } | null;
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim().slice(0, 200);
  const reasoning = parsed?.choices?.[0]?.message?.reasoning;
  if (typeof reasoning === "string" && reasoning.trim()) return reasoning.trim().slice(0, 200);
  return null;
}
