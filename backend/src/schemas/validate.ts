import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

/** Validates and replaces req.body with the parsed value (PRD §7.2 fail fast). */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as Record<string, unknown>;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Validates and replaces req.query with the parsed value. */
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // req.query is a getter in Express 5; assign parsed values via Object.assign.
      const parsed = schema.parse(req.query) as Record<string, unknown>;
      Object.assign(req.query, parsed);
      next();
    } catch (error) {
      next(error);
    }
  };
}
