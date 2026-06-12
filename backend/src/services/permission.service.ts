import type { Types } from "mongoose";
import type { Action, Resource, UserRole } from "../config/constants.js";
import { ROLE_PERMISSIONS } from "../config/constants.js";
import type { IUser } from "../models/User.model.js";
import { AppError } from "../utils/AppError.js";

function matchesPermission(granted: string, required: string): boolean {
  if (granted === "*") return true;
  const [gResource, gAction] = granted.split(":");
  const [rResource, rAction] = required.split(":");
  if (gResource === rResource && gAction === "*") return true;
  return granted === required;
}

export function getUserPermissions(user: IUser): string[] {
  const rolePerms = ROLE_PERMISSIONS[user.role as UserRole] ?? [];
  return [...new Set([...rolePerms, ...user.permissions])];
}

export function can(
  user: IUser,
  action: Action,
  resource: Resource,
  _data?: Record<string, unknown>
): boolean {
  const required = `${resource}:${action}`;
  const permissions = getUserPermissions(user);
  return permissions.some((p) => matchesPermission(p, required));
}

export function assertPermission(
  user: IUser,
  action: Action,
  resource: Resource
): void {
  if (!can(user, action, resource)) {
    throw new AppError(
      "FORBIDDEN",
      "You don't have permission to access this resource",
      403
    );
  }
}

export function buildTenantFilter(user: IUser): Record<string, unknown> {
  if (user.role === "super_admin") return {};

  const filter: Record<string, unknown> = {};

  if (user.companyId) {
    filter.companyId = user.companyId;
  }

  if (user.role === "branch_manager" && user.branchId) {
    filter.branchId = user.branchId;
  }

  return filter;
}

export function assertCompanyAccess(
  user: IUser,
  companyId?: Types.ObjectId | string | null
): void {
  if (user.role === "super_admin") return;
  if (!companyId || !user.companyId) {
    throw new AppError("FORBIDDEN", "Company access denied", 403);
  }
  if (String(user.companyId) !== String(companyId)) {
    throw new AppError("FORBIDDEN", "Company access denied", 403);
  }
}

export function assertBranchAccess(
  user: IUser,
  branchId?: Types.ObjectId | string | null,
  companyId?: Types.ObjectId | string | null
): void {
  if (user.role === "super_admin") return;

  assertCompanyAccess(user, companyId);

  if (user.role === "business_owner" || user.role === "hr_manager") return;

  if (user.role === "branch_manager") {
    if (!branchId || String(user.branchId) !== String(branchId)) {
      throw new AppError("FORBIDDEN", "Branch access denied", 403);
    }
  }
}

export function assertSelfOrElevated(
  user: IUser,
  employeeId?: Types.ObjectId | string | null
): void {
  if (["super_admin", "business_owner", "hr_manager", "branch_manager"].includes(user.role)) {
    return;
  }
  if (!employeeId || String(user.employeeId) !== String(employeeId)) {
    throw new AppError("FORBIDDEN", "You can only access your own data", 403);
  }
}
