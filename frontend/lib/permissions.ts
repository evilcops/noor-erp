import type { ApiUser, UserRole } from "@/types/auth-user";

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],
  business_owner: [
    "company:view", "company:edit", "branch:*", "employee:*", "attendance:*",
    "leave:*", "recruitment:*", "performance:*", "notification:*", "report:*", "user:*",
  ],
  branch_manager: [
    "branch:view", "employee:view", "employee:edit", "attendance:*",
    "leave:view", "leave:approve", "recruitment:view", "recruitment:edit",
    "performance:view", "performance:edit", "notification:view", "report:view", "report:export",
  ],
  hr_manager: [
    "company:view", "branch:view", "employee:*", "attendance:view", "attendance:create",
    "attendance:edit", "attendance:delete", "attendance:approve",
    "leave:*", "recruitment:*", "performance:*", "notification:view", "report:*",
  ],
  employee: [
    "employee:view", "attendance:create", "attendance:view", "leave:create", "leave:view",
    "performance:view", "notification:view",
  ],
};

function matchPermission(granted: string, required: string): boolean {
  if (granted === "*") return true;
  const [gRes, gAct] = granted.split(":");
  const [rRes, rAct] = required.split(":");
  if (gRes === rRes && (gAct === "*" || gAct === rAct)) return true;
  return false;
}

export function hasPermission(user: ApiUser | null, permission: string): boolean {
  if (!user) return false;
  const perms = user.permissions?.length
    ? user.permissions
    : ROLE_PERMISSIONS[user.role] ?? [];
  return perms.some((p) => matchPermission(p, permission));
}

export function isManager(user: ApiUser | null): boolean {
  if (!user) return false;
  return ["super_admin", "business_owner", "branch_manager", "hr_manager"].includes(user.role);
}

export function isHrOrAbove(user: ApiUser | null): boolean {
  if (!user) return false;
  return ["super_admin", "business_owner", "hr_manager"].includes(user.role);
}
