const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

function buildHeaders(body: unknown): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return headers;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const data = (payload ?? {}) as {
    error_code?: string;
    message?: string;
    errors?: Record<string, string[]>;
    error?: { code?: string; message?: string };
  };
  return new ApiError(
    response.status,
    data.error_code ?? data.error?.code ?? "INTERNAL_ERROR",
    data.message ?? data.error?.message ?? "Request failed",
    data.errors ?? {},
  );
}

/**
 * Calls the management API. On a 401 it refreshes the session once and retries,
 * otherwise the caller is responsible for reacting to the error (PRD §7.3).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: buildHeaders(body),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  };

  let response = await fetch(`${API_BASE}${path}`, init);

  const isAuthEndpoint = path.startsWith("/auth/");
  if (response.status === 401 && !isAuthEndpoint) {
    const refreshed = await tryRefresh();
    if (refreshed) response = await fetch(`${API_BASE}${path}`, init);
  }

  const payload = await parseBody(response);
  if (!response.ok) throw toApiError(response, payload);
  return payload as T;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export { API_BASE };
