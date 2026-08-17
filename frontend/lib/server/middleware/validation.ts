import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../utils/AppError";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const payload = req[part] ?? {};
    const result = schema.safeParse(payload);
    if (!result.success) {
      const issue = result.error.issues[0];
      const detail = issue?.message ?? "Invalid input";
      return next(
        new AppError("VALIDATION_ERROR", detail, 422, result.error.flatten().fieldErrors)
      );
    }
    req[part] = result.data;
    next();
  };
}
