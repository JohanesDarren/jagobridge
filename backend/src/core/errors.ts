/**
 * Error classes (PRD §9.4).
 * - AppError: management API (/api/v1/*), standard error envelope.
 * - GatewayError: AI gateway (/v1/*), OpenAI-compatible envelope.
 */

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type GatewayErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "permission_error"
  | "not_found_error"
  | "rate_limit_error"
  | "api_error";

export class GatewayError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly errorType: GatewayErrorType,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/** Maps an HTTP status to the OpenAI `error.type` for gateway responses. */
export function gatewayErrorTypeForStatus(statusCode: number): GatewayErrorType {
  switch (statusCode) {
    case 400:
    case 422:
      return "invalid_request_error";
    case 401:
      return "authentication_error";
    case 403:
      return "permission_error";
    case 404:
      return "not_found_error";
    case 429:
      return "rate_limit_error";
    default:
      return "api_error";
  }
}

/** Convenience factory used by the pipeline for OpenAI-shaped rejections. */
export function gatewayError(
  statusCode: number,
  errorCode: string,
  message: string,
  retryAfterSeconds?: number,
): GatewayError {
  return new GatewayError(statusCode, errorCode, gatewayErrorTypeForStatus(statusCode), message, retryAfterSeconds);
}
