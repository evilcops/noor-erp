import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { CreateBranchInput, Branch, UpdateBranchInput } from "@/types/branch";
import type { PaginatedParams } from "@/types/api";

export type { Branch } from "@/types/branch";

export const branchApi = {
  getAll: (params: PaginatedParams & { companyId?: string } = {}) =>
    apiRequestWithMeta<Branch[]>(`/branches${buildQuery(params as Record<string, string | number | undefined>)}`),

  getById: (id: string) => apiRequest<Branch>(`/branches/${id}`),

  create: (data: CreateBranchInput) =>
    apiRequest<Branch>("/branches", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateBranchInput) =>
    apiRequest<Branch>(`/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/branches/${id}`, { method: "DELETE" }),
};
