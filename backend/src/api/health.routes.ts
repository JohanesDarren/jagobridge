import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { pingDatabase } from "../db/knex.js";
import { pingRedis } from "../db/redis.js";
import { checkUpstreamHealth } from "../gateway/upstream-client.js";

export const healthRouter = Router();

const VERSION = "1.0.0";

/**
 * GET /health — no authentication (PRD F-13).
 * healthy (200) / degraded (200 when upstream is down) / unhealthy (503 when
 * the database or Redis is down).
 */
healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [database, redisHealthy, upstream] = await Promise.all([
      pingDatabase(),
      pingRedis(),
      checkUpstreamHealth(),
    ]);

    const services = {
      database: database ? "healthy" : "unhealthy",
      redis: redisHealthy ? "healthy" : "unhealthy",
      upstream_9router: upstream ? "healthy" : "degraded",
    };

    let status: "healthy" | "degraded" | "unhealthy";
    let httpStatus: number;
    if (!database || !redisHealthy) {
      status = "unhealthy";
      httpStatus = 503;
    } else if (!upstream) {
      status = "degraded";
      httpStatus = 200;
    } else {
      status = "healthy";
      httpStatus = 200;
    }

    res.status(httpStatus).json({
      status,
      version: VERSION,
      timestamp: new Date().toISOString(),
      services,
    });
  }),
);
