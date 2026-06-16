import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { logger } from "../utils/logger";

const PERSISTENT_MEMORY_DB_PATH =
  process.env.MEMORY_DB_PATH ?? path.join(process.cwd(), ".data", "mongo");

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

let memoryServer: { stop: () => Promise<boolean>; getUri: () => string } | null = null;

function maskUri(uri: string): string {
  return uri.replace(/:([^:@/]+)@/, ":****@");
}

export function getMongoUri(): string {
  if (process.env.USE_MEMORY_DB === "true" || process.env.MONGODB_URI === "memory://") {
    return memoryServer?.getUri() ?? "memory://pending";
  }

  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes("xxxxx")) {
    return process.env.MONGODB_URI;
  }

  return "mongodb://127.0.0.1:27017/noor_erp";
}

async function resolveUri(): Promise<string> {
  if (process.env.USE_MEMORY_DB === "true" || process.env.MONGODB_URI === "memory://") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    fs.mkdirSync(PERSISTENT_MEMORY_DB_PATH, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      instance: { dbPath: PERSISTENT_MEMORY_DB_PATH },
    });
    const uri = memoryServer.getUri();
    logger.info("Using file-backed dev MongoDB", {
      uri: maskUri(uri),
      dbPath: PERSISTENT_MEMORY_DB_PATH,
    });
    return uri;
  }
  return getMongoUri();
}

function formatConnectionError(error: unknown, uri: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const lines = [
    `MongoDB connection failed: ${message}`,
    `URI: ${maskUri(uri)}`,
    "",
    "Set MONGODB_URI in .env (e.g. mongodb://127.0.0.1:27017/noor_erp or mongodb+srv://...)",
    "For local dev without MongoDB, set USE_MEMORY_DB=true",
  ];
  return lines.join("\n");
}

export async function connectDatabase(): Promise<typeof mongoose> {
  const cached = global.mongooseCache ?? { conn: null, promise: null };
  global.mongooseCache = cached;

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set("strictQuery", true);

    cached.promise = (async () => {
      const uri = await resolveUri();
      try {
        const connection = await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 15_000,
          family: 4,
        });
        logger.info("MongoDB connected", { uri: maskUri(uri) });
        return connection;
      } catch (error) {
        const help = formatConnectionError(error, uri);
        logger.error(help);
        throw new Error(help);
      }
    })();
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function disconnectDatabase(): Promise<void> {
  if (global.mongooseCache?.conn) {
    await mongoose.disconnect();
    global.mongooseCache = { conn: null, promise: null };
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  logger.info("MongoDB disconnected");
}
