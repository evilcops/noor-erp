import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { BusinessDocument, ExpiringBusinessDocAlert } from "@/types/documents";

export const businessDocApi = {
  list: (params: { companyId?: string } = {}) =>
    apiRequestWithMeta<BusinessDocument[]>(`/documents/business${buildQuery(params as Record<string, string | undefined>)}`),

  getById: (id: string) => apiRequest<BusinessDocument>(`/documents/business/${id}`),

  create: (data: Partial<BusinessDocument>) =>
    apiRequest<BusinessDocument>("/documents/business", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<BusinessDocument>) =>
    apiRequest<BusinessDocument>(`/documents/business/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/documents/business/${id}`, { method: "DELETE" }),

  uploadFile: (id: string, formData: FormData) =>
    apiRequest<BusinessDocument>(`/documents/business/${id}/upload`, {
      method: "POST",
      body: formData,
    }),

  getExpiring: () => apiRequest<ExpiringBusinessDocAlert[]>("/documents/business/expiring"),
};
