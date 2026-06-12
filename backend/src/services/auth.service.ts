import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { createHash } from "crypto";
import { authConfig } from "../config/auth.js";
import { User, type IUser } from "../models/User.model.js";
import { Company } from "../models/Company.model.js";
import type { AuthTokenPayload } from "../types/index.js";
import { AppError } from "../utils/AppError.js";
import { getUserPermissions } from "./permission.service.js";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, authConfig.bcryptRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(user: IUser): string {
  const payload: AuthTokenPayload = {
    sub: String(user._id),
    email: user.email,
    role: user.role,
    companyId: user.companyId ? String(user.companyId) : undefined,
    branchId: user.branchId ? String(user.branchId) : undefined,
    type: "access",
  };
  return jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.jwtExpiresIn,
  } as SignOptions);
}

export function signRefreshToken(user: IUser): string {
  const payload: AuthTokenPayload = {
    sub: String(user._id),
    email: user.email,
    role: user.role,
    companyId: user.companyId ? String(user.companyId) : undefined,
    branchId: user.branchId ? String(user.branchId) : undefined,
    type: "refresh",
  };
  return jwt.sign(payload, authConfig.jwtRefreshSecret, {
    expiresIn: authConfig.jwtRefreshExpiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  try {
    const payload = jwt.verify(token, authConfig.jwtSecret) as AuthTokenPayload;
    if (payload.type !== "access") throw new AppError("UNAUTHORIZED", "Invalid token type", 401);
    return payload;
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
  }
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  try {
    const payload = jwt.verify(token, authConfig.jwtRefreshSecret) as AuthTokenPayload;
    if (payload.type !== "refresh") throw new AppError("UNAUTHORIZED", "Invalid token type", 401);
    return payload;
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid or expired refresh token", 401);
  }
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select(
    "+password +refreshTokenHash"
  );
  if (!user) throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  user.lastLogin = new Date();
  await user.save();

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  companyName?: string;
  companyCode?: string;
}) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new AppError("CONFLICT", "Email already registered", 409);

  const userCount = await User.countDocuments();
  const isFirstUser = userCount === 0;
  const role = isFirstUser ? "business_owner" : "employee";

  let companyId;
  if (isFirstUser && input.companyName && input.companyCode) {
    const company = await Company.create({
      name: input.companyName,
      code: input.companyCode.toUpperCase(),
      email: input.email,
      phone: input.phone,
    });
    companyId = company._id;
  }

  const user = await User.create({
    email: input.email.toLowerCase(),
    password: await hashPassword(input.password),
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    role,
    companyId,
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  return { user: sanitizeUser(user), accessToken, refreshToken, isFirstUser };
}

export async function refreshUserTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub).select("+refreshTokenHash");
  if (!user || !user.isActive) throw new AppError("UNAUTHORIZED", "User not found", 401);
  if (user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError("UNAUTHORIZED", "Refresh token revoked", 401);
  }

  const accessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save();

  return { accessToken, refreshToken: newRefreshToken, user: sanitizeUser(user) };
}

export async function logoutUser(userId: string) {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw new AppError("NOT_FOUND", "User not found", 404);
  return {
    ...sanitizeUser(user),
    permissions: getUserPermissions(user),
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) throw new AppError("UNAUTHORIZED", "Current password is incorrect", 401);

  user.password = await hashPassword(newPassword);
  await user.save();
}

function sanitizeUser(user: IUser) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
    branchId: user.branchId,
    employeeId: user.employeeId,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
  };
}

export async function generateEmployeeId(companyId: string): Promise<string> {
  const count = await import("../models/Employee.model.js").then((m) =>
    m.Employee.countDocuments({ companyId })
  );
  return `EMP-${String(count + 1).padStart(4, "0")}`;
}
