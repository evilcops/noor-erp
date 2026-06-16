import type { NextFunction, Request, Response } from "express";
import { logAuditAsync } from "../services/audit.service";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function auditMiddleware(entityType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!WRITE_METHODS.has(req.method) || !req.user) {
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (
        typeof body === "object" &&
        body !== null &&
        (body as { success?: boolean }).success === true
      ) {
        const actionMap: Record<string, "create" | "update" | "delete" | "approve" | "reject"> = {
          POST: "create",
          PUT: "update",
          PATCH: "update",
          DELETE: "delete",
        };

        let action = actionMap[req.method] ?? "update";
        if (req.path.includes("/approve")) action = "approve";
        if (req.path.includes("/reject")) action = "reject";

        const data = (body as { data?: Record<string, unknown> }).data;
        const paramId = req.params.id;
        const entityId =
          (Array.isArray(paramId) ? paramId[0] : paramId) ??
          (data?._id as string | undefined) ??
          (data?.id as string | undefined);

        if (entityId) {
          logAuditAsync({
            userId: req.user!._id,
            companyId: req.user!.companyId,
            action,
            entityType,
            entityId,
            oldValue: req.auditMeta?.oldValue,
            newValue: data as Record<string, unknown>,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }
      }
      return originalJson(body);
    };

    next();
  };
}
