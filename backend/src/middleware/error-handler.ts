import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, GatewayError, gatewayErrorTypeForStatus } from "../core/errors.js";
import { logger } from "../core/logger.js";

/**
 * Management API error handler (PRD §6.4 standard error envelope).
 * Gateway routes (/v1/*) send OpenAI-shaped errors directly from their own handler.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    logger.error({ errorCode: err.errorCode, requestId: req.id }, err.message);
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      error_code: err.errorCode,
      errors: err.errors,
    });
    return;
  }

  if (err instanceof GatewayError) {
    if (err.retryAfterSeconds) res.setHeader("Retry-After", String(err.retryAfterSeconds));
    logger.error({ errorCode: err.errorCode, requestId: req.id }, err.message);
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        type: err.errorType,
        code: err.errorCode,
        param: null,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "body";
      errors[key] = [...(errors[key] ?? []), issue.message];
    }
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      error_code: "VALIDATION_ERROR",
      errors,
    });
    return;
  }

  logger.fatal({ err, requestId: req.id }, "unhandled_exception");
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    error_code: "INTERNAL_ERROR",
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: "error",
    message: "Endpoint not found",
    error_code: "NOT_FOUND",
  });
}

export { gatewayErrorTypeForStatus };
