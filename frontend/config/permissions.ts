import type { Action, Resource, UserRole } from "@/types/auth-user";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  business_owner: "Admin",
  branch_manager: "Branch Manager",
  hr_manager: "HR Manager",
  employee: "Employee",
};

export const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard: "Dashboard",
  company: "Company",
  branch: "Branches",
  employee: "Employees",
  attendance: "Attendance",
  leave: "Leave",
  recruitment: "Recruitment",
  performance: "Performance",
  notification: "Notifications",
  report: "Reports",
  audit: "Audit Logs",
  user: "Users & Roles",
};

export const ACTION_LABELS: Record<Action, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
  assign: "Assign",
  archive: "Archive",
};

/** Actions shown in the permission matrix UI */
export const UI_ACTIONS: Action[] = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
];

/** Resources shown in the permission matrix UI */
export const UI_RESOURCES: Resource[] = [
  "dashboard",
  "company",
  "branch",
  "employee",
  "attendance",
  "leave",
  "recruitment",
  "performance",
  "notification",
  "report",
  "user",
];

export function permissionKey(resource: Resource, action: Action): string {
  return `${resource}:${action}`;
}

export function expandPermission(key: string): string[] {
  if (key === "*") return ["*"];
  const [resource, action] = key.split(":");
  if (action === "*") {
    return UI_ACTIONS.map((a) => `${resource}:${a}`);
  }
  return [key];
}

export function hasPermissionInList(permissions: string[], required: string): boolean {
  return permissions.some((granted) => {
    if (granted === "*") return true;
    const [gRes, gAct] = granted.split(":");
    const [rRes, rAct] = required.split(":");
    if (gRes === rRes && (gAct === "*" || gAct === rAct)) return true;
    return false;
  });
}
