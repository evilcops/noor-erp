export type UserRole =
  | "super_admin"
  | "business_owner"
  | "branch_manager"
  | "hr_manager"
  | "employee";

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
}

export interface LoginResult {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}
