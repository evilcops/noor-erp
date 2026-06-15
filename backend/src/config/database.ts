import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PERSISTENT_MEMORY_DB_PATH =
  process.env.MEMORY_DB_PATH ?? path.join(backendRoot, ".data", "mongo");

let memoryServer: { stop: () => Promise<boolean>; getUri: () => string } | null = null;

function maskUri(uri: string): string {
  return uri.replace(/:([^:@/]+)@/, ":****@");
}

function buildAtlasUri(): string | null {
  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  const cluster = process.env.MONGODB_CLUSTER;
  const db = process.env.MONGODB_DB ?? "noor_erp";

  if (user && password && cluster && !cluster.includes("xxxxx")) {
    const encodedUser = encodeURIComponent(user);
    const encodedPass = encodeURIComponent(password);
    return `mongodb+srv://${encodedUser}:${encodedPass}@${cluster}/${db}?retryWrites=true&w=majority&appName=Cluster0`;
  }
  return null;
}

export function getMongoUri(): string {
  if (process.env.USE_MEMORY_DB === "true" || process.env.MONGODB_URI === "memory://") {
    return memoryServer?.getUri() ?? "memory://pending";
  }

  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes("xxxxx")) {
    return process.env.MONGODB_URI;
  }

  const atlas = buildAtlasUri();
  if (atlas) return atlas;

  return "mongodb://127.0.0.1:27017/noor_erp";
}

async function resolveUri(): Promise<string> {
  if (process.env.USE_MEMORY_DB === "true" || process.env.MONGODB_URI === "memory://") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    fs.mkdirSync(PERSISTENT_MEMORY_DB_PATH, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      instance: { dbPath: PERSISTENT_MEMORY_DB_PATH },
    });
    const uri = memoryServer.getUri("noor_erp");
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
  const isSsl =
    message.includes("SSL") ||
    message.includes("tlsv1") ||
    message.includes("alert number 80");

  const lines = [
    `MongoDB connection failed: ${message}`,
    `URI: ${maskUri(uri)}`,
    "",
  ];

  if (isSsl) {
    lines.push(
      "This is usually a MongoDB Atlas network/SSL issue. Try:",
      "  1. Atlas → Network Access → Add IP Address (your IP or 0.0.0.0/0 for dev)",
      "  2. Atlas → Database → ensure cluster is not Paused",
      "  3. Verify MONGODB_USER / MONGODB_PASSWORD in backend/.env",
      "",
      "Quick local fix (no Atlas): add to backend/.env",
      "  USE_MEMORY_DB=true",
      "Then restart: npm run dev"
    );
  } else {
    lines.push(
      "Check that MongoDB is running and credentials in backend/.env are correct.",
      "For local dev without Atlas, set USE_MEMORY_DB=true in backend/.env"
    );
  }

  return lines.join("\n");
}

export async function connectDatabase(): Promise<void> {
  const uri = await resolveUri();

  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error", { error: err.message });
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15_000,
      family: 4,
    });
  } catch (error) {
    const help = formatConnectionError(error, uri);
    logger.error(help);
    throw new Error(help);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  logger.info("MongoDB disconnected");
}
