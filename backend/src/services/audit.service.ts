import type { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.model.js";
import type { AuditLogInput } from "../types/index.js";
import { logger } from "../utils/logger.js";

function computeChanges(
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>
) {
  if (!oldValue || !newValue) return [];
  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

  for (const field of keys) {
    const oldV = oldValue[field];
    const newV = newValue[field];
    if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
      changes.push({ field, oldValue: oldV, newValue: newV });
    }
  }
  return changes;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const changes = computeChanges(input.oldValue, input.newValue);
    await AuditLog.create({
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue,
      newValue: input.newValue,
      changes,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error("Audit log failed (non-blocking)", {
      error: error instanceof Error ? error.message : error,
    });
  }
}

export function logAuditAsync(input: AuditLogInput): void {
  setImmediate(() => {
    void logAudit(input);
  });
}

export async function getAuditLogs(filters: {
  companyId?: Types.ObjectId | string;
  entityType?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filters.companyId) query.companyId = filters.companyId;
  if (filters.entityType) query.entityType = filters.entityType;

  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(filters.limit).lean(),
    AuditLog.countDocuments(query),
  ]);

  return { items, total };
}
