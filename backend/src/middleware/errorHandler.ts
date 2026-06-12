import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { sendError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";

export function notFoundHandler(req: Request, res: Response) {
  return sendError(res, "NOT_FOUND", `Route ${req.method} ${req.path} not found`, 404);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.statusCode, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(res, "VALIDATION_ERROR", "Invalid input", 422, err.flatten().fieldErrors);
  }

  if (err instanceof Error && err.name === "ValidationError") {
    return sendError(res, "VALIDATION_ERROR", err.message, 422);
  }

  if (err instanceof Error && (err as { code?: number }).code === 11000) {
    return sendError(res, "CONFLICT", "Duplicate entry", 409);
  }

  logger.error("Unhandled error", { error: err });
  return sendError(res, "INTERNAL_ERROR", "Internal server error", 500);
}
