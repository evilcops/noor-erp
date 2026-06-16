import type { NextFunction, Request, Response } from "express";
import { User } from "../models/User.model";
import { verifyAccessToken } from "../services/auth.service";
import { AppError } from "../utils/AppError";
import { sendError } from "../utils/apiResponse";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      return sendError(res, "UNAUTHORIZED", "User inactive or not found", 401);
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return sendError(res, error.code, error.message, error.statusCode);
    }
    return sendError(res, "UNAUTHORIZED", "Invalid token", 401);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    void User.findById(payload.sub).then((user) => {
      if (user?.isActive) req.user = user;
      next();
    });
  } catch {
    next();
  }
}
