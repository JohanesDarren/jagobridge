import type { NextFunction, Request, Response } from "express";
import { AppError } from "../core/errors.js";
import { ACCESS_TOKEN_COOKIE, type Role } from "../core/constants.js";
import { verifyAccessToken } from "../core/security.js";
import { findUserById } from "../repositories/user.repository.js";

/** Requires a valid access-token cookie and an active user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Access token is invalid or expired");
    }
    const user = await findUserById(payload.sub);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }
    if (!user.is_active) {
      throw new AppError(403, "ACCOUNT_INACTIVE", "Account is deactivated");
    }
    req.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Role guard. Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      next(new AppError(403, "FORBIDDEN", "Your role does not allow this action"));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
