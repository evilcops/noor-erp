import type { Request, Response } from "express";
import mongoose from "mongoose";
import { getAuditLogs } from "../services/audit.service";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse";

export async function healthCheck(_req: Request, res: Response) {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? "connected" : "disconnected";
  return sendSuccess(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptime: process.uptime(),
  });
}

export async function systemInfo(_req: Request, res: Response) {
  return sendSuccess(res, {
    name: "NOOR ERP API",
    version: "1.0.0",
    phase: "Phase 1 — NOOR People",
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? "development",
    region: process.env.AWS_REGION ?? "me-south-1",
  });
}

export async function auditLogs(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query);
  const result = await getAuditLogs({
    companyId: req.query.companyId as string | undefined,
    entityType: req.query.entityType as string | undefined,
    page,
    limit,
  });
  return sendSuccess(res, result.items, 200, buildMeta(page, limit, result.total));
}
