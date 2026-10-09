/**
 * Client helpers for the admin API / Model testers.
 *
 * These call the public gateway (`/v1/*`) with a user-supplied API key, exactly
 * like an external OpenAI-compatible client would — no browser session is used.
 * Requests therefore run through the real pipeline (access, feature, limit and
 * usage checks) and are recorded in Usage.
 */

export const GATEWAY_KEY_STORAGE = "jagobridge.gateway_api_key";

export function loadGatewayKey(): string {
  try {
    return window.localStorage.getItem(GATEWAY_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function saveGatewayKey(key: string): void {
  try {
    if (key) window.localStorage.setItem(GATEWAY_KEY_STORAGE, key);
    else window.localStorage.removeItem(GATEWAY_KEY_STORAGE);
  } catch {
    // Storage can be unavailable (private mode); the tester still works in-memory.
  }
}

export interface GatewayModel {
  id: string;
  owned_by: string;
  created?: number;
}

export interface GatewayListResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  models: GatewayModel[];
  errorMessage?: string;
}

export interface GatewayUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cached_tokens?: number;
}

export interface GatewayCallResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  /** Time to first streamed token, when streaming. */
  firstTokenMs: number | null;
  requestBody: unknown;
  responseBody: unknown | null;
  responseText: string;
  /** Assembled assistant text for a streaming call, otherwise null. */
  streamedText: string | null;
  usage: GatewayUsage | null;
  errorMessage?: string;
}

interface UpstreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

function toUsage(usage: UpstreamUsage): GatewayUsage {
  return {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    cached_tokens: usage.prompt_tokens_details?.cached_tokens,
  };
}

function errorFromBody(parsed: unknown, text: string, status: number): string {
  const shape = parsed as { error?: { message?: string }; message?: string } | null;
  return shape?.error?.message ?? shape?.message ?? (text.slice(0, 300) || `HTTP ${status}`);
}

interface ModelsListPayload {
  data?: Array<{ id?: string; owned_by?: string; created?: number }>;
}

/** GET /v1/models with the supplied key. Proves the key works and lists models. */
export async function listGatewayModels(
  apiKey: string,
  signal?: AbortSignal,
): Promise<GatewayListResult> {
  const started = performance.now();
  const response = await fetch("/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal,
  });
  const text = await response.text();
  const latencyMs = Math.round(performance.now() - started);

  let parsed: ModelsListPayload | null = null;
  try {
    parsed = JSON.parse(text) as ModelsListPayload;
  } catch {
    parsed = null;
  }

  const models: GatewayModel[] = (parsed?.data ?? [])
    .filter((item): item is { id: string; owned_by?: string; created?: number } => typeof item.id === "string")
    .map((item) => ({ id: item.id, owned_by: item.owned_by ?? "unknown", created: item.created }));

  return {
    ok: response.ok,
    status: response.status,
    latencyMs,
    models,
    ...(response.ok ? {} : { errorMessage: errorFromBody(parsed, text, response.status) }),
  };
}

/** POST /v1/chat/completions. Handles both streaming (SSE) and buffered calls. */
export async function sendChatCompletion(options: {
  apiKey: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<GatewayCallResult> {
  const { apiKey, body, signal } = options;
  const streaming = body.stream === true;
  const started = performance.now();

  const response = await fetch("/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: streaming ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const result: GatewayCallResult = {
    ok: response.ok,
    status: response.status,
    latencyMs: 0,
    firstTokenMs: null,
    requestBody: body,
    responseBody: null,
    responseText: "",
    streamedText: null,
    usage: null,
  };

  const contentType = response.headers.get("content-type") ?? "";

  if (streaming && response.ok && contentType.includes("text/event-stream") && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assembled = "";
    let usage: GatewayUsage | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            usage?: UpstreamUsage;
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            if (result.firstTokenMs === null) {
              result.firstTokenMs = Math.round(performance.now() - started);
            }
            assembled += delta;
          }
          if (parsed.usage) usage = toUsage(parsed.usage);
        } catch {
          // Ignore keep-alive / non-JSON frames.
        }
      }
    }

    result.streamedText = assembled;
    result.responseText = assembled;
    result.usage = usage;
    result.responseBody = usage ? { usage } : null;
    result.latencyMs = Math.round(performance.now() - started);
    return result;
  }

  const text = await response.text();
  result.latencyMs = Math.round(performance.now() - started);
  result.responseText = text;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = null;
  }
  result.responseBody = parsed;

  if (!response.ok) {
    result.errorMessage = errorFromBody(parsed, text, response.status);
  } else if (parsed && typeof parsed === "object") {
    const withUsage = parsed as { usage?: UpstreamUsage };
    if (withUsage.usage) result.usage = toUsage(withUsage.usage);
  }
  return result;
}

/** Best-effort assistant text from a buffered chat completion response. */
export function extractAssistantText(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== "object") return null;
  const choices = (responseBody as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function toCurl(apiKey: string, body: unknown): string {
  const key = apiKey.trim() || "jb_your_api_key";
  return [
    `curl ${window.location.origin}/v1/chat/completions \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join("\n");
}

/** Runs an async worker over items with a bounded concurrency. */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldStop?: () => boolean,
): Promise<void> {
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      if (shouldStop?.()) return;
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
}
