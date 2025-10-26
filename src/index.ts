// backend/src/index.ts
/// <reference path="./types/express.d.ts" />
console.log("=== INDEX.TS: Loading modules ===");
import dotenv from "dotenv";
dotenv.config();
console.log("=== INDEX.TS: dotenv configured ===");

import express from "express";
console.log("=== INDEX.TS: express imported ===");
import connectDB from "./config/database";
console.log("=== INDEX.TS: connectDB imported ===");
import { createClient, RedisClientType } from "redis";
console.log("=== INDEX.TS: redis imported ===");
import { createBullMQ, scheduleScrapingJob } from "./config/bullmq";
console.log("=== INDEX.TS: bullmq imported ===");
import { setupRoutes } from "./routes";
console.log("=== INDEX.TS: setupRoutes imported ===");
import { setupMiddleware } from "./middleware";
console.log("=== INDEX.TS: setupMiddleware imported ===");
import { logger } from "./utils/logger";
import { setupSwagger } from "./config/swagger";

// routes
import categoriesRoutes from "./routes/categories";
import articlesRoutes from "./routes/articles"; // make sure this exists

const PORT: number = parseInt(process.env.PORT || "3001", 10);

export const app = express();

// Create Redis client only if REDIS_URL is provided; keep startup resilient for local/cloud
export let redisClient: RedisClientType | null = null;
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
  const useTLS = REDIS_URL.startsWith("rediss://");
  redisClient = createClient({
    url: REDIS_URL,
    socket: useTLS ? { tls: true } as any : undefined,
  });

  redisClient.on("error", (err) => {
    logger.error("Redis Client Error:", err);
  });
  redisClient.on("connect", () => {
    logger.info("Connected to Redis");
  });
} else {
  logger.warn("REDIS_URL not set; starting without Redis/BullMQ. Jobs will be disabled.");
}

async function startServer() {
  try {
    logger.info("🚀 Starting NewsHub Backend Server...");
    logger.info(`📍 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    logger.info(`📍 PORT: ${PORT}`);
    logger.info(`📍 REDIS_URL: ${REDIS_URL ? 'configured' : 'not set'}`);
    logger.info(`📍 DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'not set'}`);
    
    // ensure DB connection before starting other services
    await connectDB();

    // Connect Redis if configured (non-fatal on failure)
    if (redisClient) {
      try {
        await redisClient.connect();
      } catch (e) {
        logger.error("Failed to connect to Redis. Continuing without jobs.", e);
        try { await redisClient.quit(); } catch {}
        redisClient = null;
      }
    }

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // middleware, routes, swagger
    setupMiddleware(app);
    setupRoutes(app);
    setupSwagger(app);

    // mount category + article routes
    app.use("/api/categories", categoriesRoutes);
    app.use("/api/articles", articlesRoutes);

    // schedule jobs (RSS worker etc.) only when Redis is available
    if (REDIS_URL && redisClient) {
      const bullmq = createBullMQ();
      scheduleScrapingJob().catch((error) => {
        logger.error("Failed to schedule scraping job:", error);
      });
    } else {
      logger.warn("Jobs scheduler skipped (no Redis connection).");
    }

    // health
    app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      });
    });

    // generic error handler
    app.use(
      (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error("Unhandled error:", err);
        res.status(500).json({
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
        });
      }
    );

    // 404
    app.use("*", (req, res) => {
      res.status(404).json({ error: "Route not found" });
    });

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });

    const graceful = async () => {
      logger.info("Graceful shutdown initiated");
      try {
        if (redisClient) {
          await redisClient.quit();
        }
      } catch (e) {
        logger.error("Error quitting redis", e);
      }
      process.exit(0);
    };

    process.on("SIGTERM", graceful);
    process.on("SIGINT", graceful);
  } catch (err) {
    logger.error("Startup error:", err);
    process.exit(1);
  }
}

startServer();
