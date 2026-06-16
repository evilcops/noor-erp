export const ROLES = [
  "super_admin",
  "business_owner",
  "branch_manager",
  "hr_manager",
  "employee",
] as const;

export type UserRole = (typeof ROLES)[number];

export const RESOURCES = [
  "company",
  "branch",
  "employee",
  "attendance",
  "leave",
  "recruitment",
  "performance",
  "notification",
  "report",
  "audit",
  "user",
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
  "assign",
  "archive",
] as const;

export type Action = (typeof ACTIONS)[number];

export const DEFAULT_TIMEZONE = "Asia/Muscat";
export const DEFAULT_GPS_RADIUS_M = 100;
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],
  business_owner: [
    "company:view",
    "company:edit",
    "branch:*",
    "employee:*",
    "attendance:*",
    "leave:*",
    "recruitment:*",
    "performance:*",
    "notification:*",
    "report:*",
    "user:*",
  ],
  branch_manager: [
    "branch:view",
    "employee:view",
    "employee:edit",
    "attendance:*",
    "leave:view",
    "leave:approve",
    "recruitment:view",
    "recruitment:edit",
    "performance:view",
    "performance:edit",
    "notification:view",
    "report:view",
    "report:export",
  ],
  hr_manager: [
    "company:view",
    "branch:view",
    "employee:*",
    "attendance:view",
    "attendance:create",
    "attendance:edit",
    "attendance:delete",
    "attendance:approve",
    "leave:*",
    "recruitment:*",
    "performance:*",
    "notification:*",
    "report:*",
  ],
  employee: [
    "employee:view",
    "attendance:view",
    "attendance:create",
    "leave:view",
    "leave:create",
    "performance:view",
    "notification:view",
  ],
};
