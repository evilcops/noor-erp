import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type { CreateSupplierInput, Supplier, SupplierDetail, UpdateSupplierInput } from "@/types/supplier";

export const supplierApi = {
  list: (params: PaginatedParams & { status?: string } = {}) =>
    apiRequestWithMeta<Supplier[]>(`/suppliers${buildQuery(params as Record<string, string | number | undefined>)}`),

  get: (id: string) => apiRequest<SupplierDetail>(`/suppliers/${id}`),

  create: (data: CreateSupplierInput) =>
    apiRequest<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateSupplierInput) =>
    apiRequest<Supplier>(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/suppliers/${id}`, { method: "DELETE" }),
};
