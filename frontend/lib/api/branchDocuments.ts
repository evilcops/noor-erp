import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { BranchDocument, ExpiringBranchDocAlert } from "@/types/documents";

export const branchDocApi = {
  list: (params: { branchId?: string } = {}) =>
    apiRequestWithMeta<BranchDocument[]>(`/documents/branch${buildQuery(params)}`),

  getById: (id: string) => apiRequest<BranchDocument>(`/documents/branch/${id}`),

  create: (data: Partial<BranchDocument> & { branchId: string }) =>
    apiRequest<BranchDocument>("/documents/branch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<BranchDocument>) =>
    apiRequest<BranchDocument>(`/documents/branch/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/documents/branch/${id}`, { method: "DELETE" }),

  uploadFile: (id: string, formData: FormData) =>
    apiRequest<BranchDocument>(`/documents/branch/${id}/upload`, {
      method: "POST",
      body: formData,
    }),

  getExpiring: () => apiRequest<ExpiringBranchDocAlert[]>("/documents/branch/expiring"),
};
