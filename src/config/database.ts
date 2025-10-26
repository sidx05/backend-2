// backend/src/config/database.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config(); // make sure env vars are loaded when this module loads

const DEFAULT_MONGO = "mongodb://localhost:27017/newshub";

/**
 * Connects to MongoDB using mongoose.
 * - Reads DATABASE_URL, then MONGO_URI, then MONGO_URL, then falls back to local.
 * - Returns a promise so callers can await the connection.
 */
export default async function connectDB(): Promise<typeof mongoose> {
  const uri =
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    DEFAULT_MONGO;

  if (!uri) {
    logger.error(
      "❌ FATAL: MongoDB connection string not found in env (DATABASE_URL / MONGO_URI / MONGO_URL) and no default is available."
    );
    logger.error("Available env vars:", Object.keys(process.env).join(", "));
    process.exit(1);
  }
  
  logger.info("🔄 Attempting to connect to MongoDB...");
  console.log("=== DATABASE: About to connect to mongoose ===");

  // recommended mongoose settings
  mongoose.set("strictQuery", false);

  try {
    console.log("=== DATABASE: Calling mongoose.connect ===");
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // Increase timeout to 10s
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
    });
    console.log("=== DATABASE: mongoose.connect completed successfully ===");

    // hide credentials if present when logging
    const safeUri = uri.replace(/\/\/(.+@)/, "//***@");
    logger.info(`✅ Connected to MongoDB (${safeUri})`);
    return mongoose;
  } catch (err: any) {
    console.error("=== DATABASE: Connection failed ===", err);
    logger.error("❌ FATAL: MongoDB connection error:", err?.message || err);
    logger.error("Connection URI (masked):", uri.replace(/\/\/(.+@)/, "//***@"));
    logger.error("Available env vars:", Object.keys(process.env).join(", "));
    throw new Error(`MongoDB connection failed: ${err?.message || err}`);
  }
}
