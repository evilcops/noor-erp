import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";

export interface Company {
  _id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  status: string;
}

export const companyApi = {
  getAll: (params: { limit?: number; search?: string } = {}) =>
    apiRequestWithMeta<Company[]>(`/companies${buildQuery({ limit: 100, ...params })}`),

  getById: (id: string) => apiRequest<Company>(`/companies/${id}`),

  create: (data: { name: string; code: string; email?: string; phone?: string; address?: string }) =>
    apiRequest<Company>("/companies", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<{ name: string; email: string; phone: string; address: string; status: string }>) =>
    apiRequest<Company>(`/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/companies/${id}`, { method: "DELETE" }),
};
