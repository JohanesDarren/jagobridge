import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { loadEnv } from "./core/env.js";
import { logger } from "./core/logger.js";
import { requestId } from "./middleware/request-id.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { managementRateLimiter } from "./middleware/rate-limit.js";
import { healthRouter } from "./api/health.routes.js";
import { authRouter } from "./api/v1/auth.routes.js";
import { usersRouter } from "./api/v1/users.routes.js";
import { accessProfilesRouter } from "./api/v1/access-profiles.routes.js";
import { modelsRouter } from "./api/v1/models.routes.js";
import { featuresRouter } from "./api/v1/features.routes.js";
import { apiKeysRouter } from "./api/v1/api-keys.routes.js";
import { usageRouter } from "./api/v1/usage.routes.js";
import { settingsRouter } from "./api/v1/settings.routes.js";
import { auditLogsRouter } from "./api/v1/audit-logs.routes.js";
import { gatewayRouter } from "./gateway/gateway.routes.js";

const env = loadEnv();

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()),
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as { id?: string }).id ?? "req_unknown" }));

  // Public health check (no auth, cached upstream probe).
  app.use("/health", healthRouter);

  // Management API.
  const api = express.Router();
  api.use(managementRateLimiter);
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/access-profiles", accessProfilesRouter);
  api.use("/models", modelsRouter);
  api.use("/features", featuresRouter);
  api.use("/api-keys", apiKeysRouter);
  api.use("/usage", usageRouter);
  api.use("/settings", settingsRouter);
  api.use("/audit-logs", auditLogsRouter);
  app.use("/api/v1", api);

  // OpenAI-compatible AI gateway.
  app.use("/v1", gatewayRouter);

  // Single-process deploy: serve the built SPA and let client-side routes fall
  // back to index.html. API 404s must stay JSON, so the fallback is registered
  // only for non-API paths.
  if (env.SERVE_FRONTEND) {
    const distDir = path.resolve(process.cwd(), env.FRONTEND_DIST_DIR);
    const indexHtml = path.join(distDir, "index.html");

    if (!fs.existsSync(indexHtml)) {
      logger.warn({ distDir }, "frontend_dist_missing_spa_serving_disabled");
    } else {
      app.use(express.static(distDir, { index: false }));
      app.get(/^\/(?!api\/|v1\/|health$).*/, (_req, res) => {
        res.sendFile(indexHtml);
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
