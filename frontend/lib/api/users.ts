import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type { ApiUser, UserRole } from "@/types/auth-user";

export interface ManagedUser extends ApiUser {
  effectivePermissions?: string[];
  createdAt?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  companyId?: string;
  branchId?: string;
  useCustomPermissions?: boolean;
  permissions?: string[];
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  branchId?: string;
  isActive?: boolean;
  useCustomPermissions?: boolean;
  permissions?: string[];
}

export interface RoleDefinition {
  role: UserRole;
  permissions: string[];
}

export const userApi = {
  getAll: (params: PaginatedParams & { role?: string } = {}) =>
    apiRequestWithMeta<ManagedUser[]>(
      `/users${buildQuery(params as Record<string, string | number | undefined>)}`
    ),

  getById: (id: string) => apiRequest<ManagedUser>(`/users/${id}`),

  create: (data: CreateUserInput) =>
    apiRequest<ManagedUser>("/users", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateUserInput) =>
    apiRequest<ManagedUser>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/users/${id}`, { method: "DELETE" }),

  getRoleDefinitions: () => apiRequest<RoleDefinition[]>("/permissions/roles"),
};
