import type { Request, Response } from "express";
import {
  changePassword,
  getMe,
  loginUser,
  logoutUser,
  refreshUserTokens,
  registerUser,
} from "../services/auth.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

export async function register(req: Request, res: Response) {
  const result = await registerUser(req.body);
  return sendSuccess(res, result, 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const result = await loginUser(email, password);
  return sendSuccess(res, result);
}

export async function logout(req: Request, res: Response) {
  if (req.user) await logoutUser(String(req.user._id));
  return sendSuccess(res, { message: "Logged out successfully" });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  const result = await refreshUserTokens(refreshToken);
  return sendSuccess(res, result);
}

export async function me(req: Request, res: Response) {
  const user = await getMe(String(req.user!._id));
  return sendSuccess(res, { user });
}

export async function changePasswordHandler(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  await changePassword(String(req.user!._id), currentPassword, newPassword);
  return sendSuccess(res, { message: "Password updated successfully" });
}

export async function forgotPassword(_req: Request, res: Response) {
  // Placeholder — email service integration in Phase 1.5
  return sendSuccess(res, {
    message: "If the email exists, a reset link has been sent",
  });
}

export async function resetPassword(_req: Request, res: Response) {
  throw new AppError("NOT_IMPLEMENTED", "Password reset via token coming soon", 501);
}
