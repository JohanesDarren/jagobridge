import type { Response } from "express";
import { GatewayError, gatewayErrorTypeForStatus } from "../core/errors.js";

export interface OpenAiErrorBody {
  error: {
    message: string;
    type: string;
    code: string;
    param: null;
  };
}

export function buildOpenAiErrorBody(err: GatewayError): OpenAiErrorBody {
  return {
    error: {
      message: err.message,
      type: err.errorType,
      code: err.errorCode,
      param: null,
    },
  };
}

/** Sends an OpenAI-shaped error, including Retry-After when present. */
export function sendGatewayError(res: Response, err: GatewayError): void {
  if (res.headersSent) {
    // Streaming already started: emit an SSE error frame then end.
    res.write(`data: ${JSON.stringify(buildOpenAiErrorBody(err))}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  if (err.retryAfterSeconds) res.setHeader("Retry-After", String(err.retryAfterSeconds));
  res.status(err.statusCode).json(buildOpenAiErrorBody(err));
}

export function openAiError(
  statusCode: number,
  code: string,
  message: string,
  retryAfterSeconds?: number,
): GatewayError {
  return new GatewayError(statusCode, code, gatewayErrorTypeForStatus(statusCode), message, retryAfterSeconds);
}
