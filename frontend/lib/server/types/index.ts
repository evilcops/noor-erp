import type { Types } from "mongoose";
import type { UserRole } from "../config/constants";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId?: string;
  branchId?: string;
  type: "access" | "refresh";
}

export interface RequestContext {
  companyId?: Types.ObjectId | string;
  branchId?: Types.ObjectId | string;
  employeeId?: Types.ObjectId | string;
}

export interface AuditLogInput {
  userId: Types.ObjectId | string;
  companyId?: Types.ObjectId | string;
  action: "create" | "update" | "delete" | "approve" | "reject" | "export";
  entityType: string;
  entityId: Types.ObjectId | string;
  oldValue?: unknown;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
