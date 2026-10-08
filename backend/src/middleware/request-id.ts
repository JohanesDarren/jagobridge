import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { UserRow } from "../repositories/user.repository.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      requestStartAt: number;
      authUser?: UserRow;
      gatewayKey?: { id: string; userId: string; prefix: string };
    }
  }
}

/** Attaches a request ID used by logs and error responses (PRD §4.4 observability). */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  req.id = incoming && incoming.length <= 64 ? incoming : `req_${crypto.randomBytes(8).toString("hex")}`;
  req.requestStartAt = Date.now();
  res.setHeader("X-Request-Id", req.id);
  next();
}
