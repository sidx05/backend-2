import mongoose from "mongoose";
import { logger } from "../utils/logger";
import { getMongoUri, maskMongoUri } from "../config/mongoUri";

export async function connectDB() {
  try {
    const uri = getMongoUri();
    await mongoose.connect(uri);
    logger.info(`✅ Connected to MongoDB (Mongoose) ${maskMongoUri(uri)}`);
  } catch (err) {
    logger.error("❌ Failed to connect MongoDB", err);
    process.exit(1);
  }
}

export async function disconnectDB() {
  try {
    await mongoose.connection.close();
    logger.info("🔒 MongoDB connection closed");
  } catch (err) {
    logger.error("❌ Error closing MongoDB connection", err);
  }
}

export { mongoose };
