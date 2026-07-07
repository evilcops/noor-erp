export type UserRole =
  | "super_admin"
  | "business_owner"
  | "branch_manager"
  | "hr_manager"
  | "inventory_manager"
  | "procurement_manager"
  | "rider"
  | "employee";

export type Resource =
  | "dashboard"
  | "company"
  | "branch"
  | "employee"
  | "attendance"
  | "leave"
  | "recruitment"
  | "performance"
  | "product"
  | "supplier"
  | "purchase"
  | "inventory"
  | "stock_transfer"
  | "customer"
  | "rider"
  | "delivery"
  | "notification"
  | "report"
  | "audit"
  | "user";

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "assign"
  | "archive";

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  companyId?: string;
  branchId?: string;
  employeeId?: string;
  isActive: boolean;
  lastLogin?: string;
  permissions?: string[];
  useCustomPermissions?: boolean;
}

export interface LoginResult {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}
