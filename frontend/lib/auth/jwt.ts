import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";
import type { JwtPayload } from "@/types/auth";
import type { UserRole } from "@prisma/client";

function getSecret(type: "access" | "refresh"): Uint8Array {
  const key =
    type === "access"
      ? process.env.JWT_ACCESS_SECRET
      : process.env.JWT_REFRESH_SECRET;

  if (!key) {
    throw new Error(`Missing JWT secret for ${type} tokens`);
  }

  return new TextEncoder().encode(key);
}

function parseExpiry(value: string, fallback: string): string {
  return value || fallback;
}

export async function signAccessToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
}): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
  const token = await new SignJWT({
    email: payload.email,
    role: payload.role,
    companyId: payload.companyId,
    branchId: payload.branchId,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(parseExpiry(expiresIn, "15m"))
    .sign(getSecret("access"));

  return { token, expiresIn: expiryToSeconds(expiresIn) };
}

export async function signRefreshToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
}): Promise<string> {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

  return new SignJWT({
    email: payload.email,
    role: payload.role,
    companyId: payload.companyId,
    branchId: payload.branchId,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(parseExpiry(expiresIn, "7d"))
    .sign(getSecret("refresh"));
}

export async function verifyAccessToken(
  token: string
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret("access"));
    if (payload.type !== "access") return null;

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      companyId: (payload.companyId as string | null) ?? null,
      branchId: (payload.branchId as string | null) ?? null,
      type: "access",
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret("refresh"));
    if (payload.type !== "refresh") return null;

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      companyId: (payload.companyId as string | null) ?? null,
      branchId: (payload.branchId as string | null) ?? null,
      type: "refresh",
    };
  } catch {
    return null;
  }
}

export function generateOpaqueToken(): string {
  return randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 900;
  }
}
