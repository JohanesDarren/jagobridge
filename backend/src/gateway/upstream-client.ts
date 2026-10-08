import { loadEnv } from "../core/env.js";
import { logger } from "../core/logger.js";
import { HEALTH_UPSTREAM_CACHE_SECONDS, UPSTREAM_CHAT_COMPLETIONS_PATH, UPSTREAM_MODELS_PATH } from "../core/constants.js";

const env = loadEnv();

export interface UpstreamModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  capabilities?: {
    tool_calling?: boolean;
    vision_input?: boolean;
    json_mode?: boolean;
    context_length?: number;
  };
  [key: string]: unknown;
}

export function isUpstreamConfigured(): boolean {
  return Boolean(env.UPSTREAM_BASE_URL && env.UPSTREAM_API_KEY);
}

/**
 * The upstream API key is read only here and is never logged, templated, or
 * returned (PRD §6.2, §9.3).
 */
function upstreamHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.UPSTREAM_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function joinUrl(path: string): string {
  return `${env.UPSTREAM_BASE_URL.replace(/\/$/, "")}${path}`;
}

export interface UpstreamResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  errorBody?: string;
}

/** Calls GET /models on 9router. Used by sync and the connection test. */
export async function listUpstreamModels(): Promise<UpstreamResult<{ data: UpstreamModel[] }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.UPSTREAM_CONNECT_TIMEOUT_SECONDS * 1000);
  try {
    const response = await fetch(joinUrl(UPSTREAM_MODELS_PATH), {
      method: "GET",
      headers: upstreamHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error({ status: response.status }, "upstream_models_failed");
      return { ok: false, status: response.status, errorBody };
    }
    const data = (await response.json()) as { data: UpstreamModel[] };
    return { ok: true, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

let upstreamHealthCache: { healthy: boolean; checkedAt: number } | null = null;

/** Upstream reachability cached for 30 seconds (PRD F-13). */
export async function checkUpstreamHealth(): Promise<boolean> {
  const now = Date.now();
  if (upstreamHealthCache && now - upstreamHealthCache.checkedAt < HEALTH_UPSTREAM_CACHE_SECONDS * 1000) {
    return upstreamHealthCache.healthy;
  }
  if (!isUpstreamConfigured()) {
    upstreamHealthCache = { healthy: false, checkedAt: now };
    return false;
  }
  try {
    const result = await listUpstreamModels();
    const healthy = result.ok;
    upstreamHealthCache = { healthy, checkedAt: now };
    return healthy;
  } catch {
    upstreamHealthCache = { healthy: false, checkedAt: now };
    return false;
  }
}

export interface ForwardResult {
  ok: boolean;
  status: number;
  response: Response;
}

/**
 * Forwards a chat completion to 9router. The client's API key is never sent;
 * only the team upstream key is added here (PRD F-09, GW-18).
 */
export async function forwardChatCompletion(
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<ForwardResult> {
  const response = await fetch(joinUrl(UPSTREAM_CHAT_COMPLETIONS_PATH), {
    method: "POST",
    headers: upstreamHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  return { ok: response.ok, status: response.status, response };
}

export function upstreamTimeoutConfig() {
  return {
    connectMs: env.UPSTREAM_CONNECT_TIMEOUT_SECONDS * 1000,
    firstByteMs: env.UPSTREAM_FIRST_BYTE_TIMEOUT_SECONDS * 1000,
    idleMs: env.UPSTREAM_STREAM_IDLE_TIMEOUT_SECONDS * 1000,
  };
}
