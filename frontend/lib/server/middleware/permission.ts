import type { NextFunction, Request, Response } from "express";
import type { Action, Resource } from "../config/constants";
import { assertPermission } from "../services/permission.service";
import { sendError } from "../utils/apiResponse";

export function requirePermission(resource: Resource, action: Action) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
    }
    try {
      assertPermission(req.user, action, resource);
      next();
    } catch (error) {
      next(error);
    }
  };
}
