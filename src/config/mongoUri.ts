// backend/src/config/mongoUri.ts
import dotenv from "dotenv";
dotenv.config();

/**
 * Resolve the MongoDB connection string in a consistent way across the app and scripts.
 * Priority:
 * 1) MONGODB_URI
 * 2) MONGODB_URL
 * 3) MONGO_URI
 * 4) MONGO_URL
 * 5) DATABASE_URL (only if it looks like a mongodb uri)
 * 6) fallback: mongodb://localhost:27017/newshub
 */
export function getMongoUri(): string {
  const env = process.env;
  const candidates = [
    env.MONGODB_URI,
    env.MONGODB_URL,
    env.MONGO_URI,
    env.MONGO_URL,
  ].filter(Boolean) as string[];

  if (candidates.length > 0) {
    return candidates[0]!;
  }

  const dbUrl = env.DATABASE_URL || "";
  if (/^mongodb(\+srv)?:\/\//i.test(dbUrl)) {
    return dbUrl;
  }

  return "mongodb://localhost:27017/newshub";
}

export function maskMongoUri(uri: string): string {
  try {
    return uri.replace(/\/\/(.+@)/, "//***@");
  } catch {
    return uri;
  }
}
