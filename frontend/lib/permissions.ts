import type { ApiUser } from "@/types/auth-user";
import { hasPermissionInList } from "@/config/permissions";

const ROLE_PERMISSIONS: Record<ApiUser["role"], string[]> = {
  super_admin: ["*"],
  business_owner: [
    "dashboard:view",
    "company:view", "company:edit", "branch:*", "employee:*", "attendance:*",
    "leave:*", "recruitment:*", "performance:*",
    "product:*", "supplier:*", "purchase:*", "inventory:*", "stock_transfer:*", "customer:*",
    "rider:*", "delivery:*",
    "notification:*", "report:*", "user:*",
  ],
  branch_manager: [
    "dashboard:view",
    "branch:view", "employee:view", "employee:edit", "attendance:*",
    "leave:view", "leave:approve", "recruitment:view", "recruitment:edit",
    "performance:view", "performance:edit",
    "product:view", "supplier:view", "purchase:view", "purchase:create", "purchase:approve",
    "inventory:view", "inventory:edit", "stock_transfer:view", "stock_transfer:create", "stock_transfer:approve",
    "customer:view", "customer:create",
    "rider:view", "rider:edit", "delivery:view", "delivery:create", "delivery:assign", "delivery:edit",
    "notification:view", "report:view", "report:export",
  ],
  hr_manager: [
    "dashboard:view",
    "company:view", "branch:view", "employee:*", "attendance:view", "attendance:create",
    "attendance:edit", "attendance:delete", "attendance:approve",
    "leave:*", "recruitment:*", "performance:*", "notification:view", "report:*",
  ],
  inventory_manager: [
    "dashboard:view", "branch:view",
    "product:*", "supplier:view", "purchase:view", "purchase:create", "purchase:approve",
    "inventory:*", "stock_transfer:*", "customer:*", "rider:view", "delivery:*",
    "notification:view", "report:view", "report:export",
  ],
  procurement_manager: [
    "dashboard:view", "branch:view",
    "product:view", "supplier:*", "purchase:*",
    "inventory:view", "stock_transfer:view", "customer:view", "customer:create",
    "rider:view", "delivery:view", "delivery:create", "delivery:assign",
    "notification:view", "report:view", "report:export",
  ],
  rider: [
    "dashboard:view",
    "delivery:view", "delivery:edit", "notification:view",
  ],
  employee: [
    "dashboard:view",
    "employee:view", "attendance:create", "attendance:view", "leave:create", "leave:view",
    "performance:view", "notification:view",
  ],
};

export function getEffectivePermissions(user: ApiUser | null): string[] {
  if (!user) return [];
  if (user.useCustomPermissions) return user.permissions ?? [];
  if (user.permissions !== undefined && user.permissions.length > 0) return user.permissions;
  return ROLE_PERMISSIONS[user.role] ?? [];
}

export function hasPermission(user: ApiUser | null, permission: string): boolean {
  if (!user) return false;
  return hasPermissionInList(getEffectivePermissions(user), permission);
}

export function isManager(user: ApiUser | null): boolean {
  if (!user) return false;
  return [
    "super_admin", "business_owner", "branch_manager", "hr_manager",
    "inventory_manager", "procurement_manager",
  ].includes(user.role);
}

export function isHrOrAbove(user: ApiUser | null): boolean {
  if (!user) return false;
  return ["super_admin", "business_owner", "hr_manager"].includes(user.role);
}

export function isSupplyRole(user: ApiUser | null): boolean {
  if (!user) return false;
  return ["super_admin", "business_owner", "inventory_manager", "procurement_manager", "branch_manager"].includes(user.role);
}

export function isRiderRole(user: ApiUser | null): boolean {
  return user?.role === "rider";
}

export function isEmployeeRole(user: ApiUser | null): boolean {
  return user?.role === "employee";
}

export { ROLE_PERMISSIONS };
