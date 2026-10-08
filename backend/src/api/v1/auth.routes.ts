import { Router, type Response } from "express";
import { loadEnv } from "../../core/env.js";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../core/constants.js";
import { asyncHandler, requestMeta } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { loginRateLimiter } from "../../middleware/rate-limit.js";
import { validateBody } from "../../schemas/validate.js";
import { successResponse } from "../../schemas/response.js";
import { acceptInviteSchema, changePasswordSchema, loginSchema } from "../../schemas/auth.schema.js";
import {
  acceptInvite,
  changePassword,
  login,
  logout,
  refresh,
  type AuthTokens,
} from "../../services/auth.service.js";

const env = loadEnv();
export const authRouter = Router();

function cookieBase() {
  return {
    httpOnly: true,
    secure: env.APP_ENV !== "development",
    sameSite: "strict" as const,
    path: "/",
  };
}

function setAuthCookies(res: Response, tokens: AuthTokens): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...cookieBase(),
    maxAge: tokens.expiresIn * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...cookieBase(),
    maxAge: env.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, cookieBase());
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieBase());
}

function toAuthUser(user: { id: string; name: string; email: string; role: string; must_change_password: boolean; usage_notice_acknowledged: boolean }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    must_change_password: user.must_change_password,
    usage_notice_acknowledged: user.usage_notice_acknowledged,
  };
}

authRouter.post(
  "/login",
  loginRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const result = await login(email, password, requestMeta(req));
    setAuthCookies(res, result.tokens);
    res.status(200).json(
      successResponse(
        { user: toAuthUser(result.user), expires_in: result.tokens.expiresIn },
        "Login successful",
      ),
    );
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    const result = await refresh(token ?? "", requestMeta(req));
    setAuthCookies(res, result.tokens);
    res.status(200).json(
      successResponse(
        { user: toAuthUser(result.user), expires_in: result.tokens.expiresIn },
        "Token refreshed",
      ),
    );
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    await logout(token, requestMeta(req));
    clearAuthCookies(res);
    res.status(200).json(successResponse(null, "Logged out"));
  }),
);

authRouter.post(
  "/change-password",
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body as {
      current_password: string;
      new_password: string;
    };
    await changePassword(req.authUser!.id, current_password, new_password, requestMeta(req));
    clearAuthCookies(res);
    res.status(200).json(successResponse(null, "Password changed. Please sign in again."));
  }),
);

authRouter.post(
  "/accept-invite",
  loginRateLimiter,
  validateBody(acceptInviteSchema),
  asyncHandler(async (req, res) => {
    const { token, name, password } = req.body as { token: string; name: string; password: string };
    const result = await acceptInvite(token, name, password, requestMeta(req));
    setAuthCookies(res, result.tokens);
    res.status(200).json(
      successResponse(
        { user: toAuthUser(result.user), expires_in: result.tokens.expiresIn },
        "Invitation accepted",
      ),
    );
  }),
);
