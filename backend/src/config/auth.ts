import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const authConfig = {
  jwtSecret: required("JWT_SECRET", "dev-jwt-secret-change-in-production-32chars"),
  jwtRefreshSecret: required(
    "JWT_REFRESH_SECRET",
    "dev-refresh-secret-change-in-production-32chars"
  ),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? "10", 10),
};

export const appConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "5000", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
