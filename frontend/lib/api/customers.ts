import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type {
  CreateCustomerInput,
  Customer,
  CustomerDetail,
  CustomerStats,
  RecordSaleInput,
  ResolveClusterResult,
  Sale,
  UpdateCustomerInput,
} from "@/types/customer";

export const customerApi = {
  list: (params: PaginatedParams & { search?: string } = {}) =>
    apiRequestWithMeta<Customer[]>(`/customers${buildQuery(params as Record<string, string | number | undefined>)}`),

  stats: () => apiRequest<CustomerStats>("/customers/stats"),

  resolveCluster: (params: {
    companyId?: string;
    branchId?: string;
    lat?: number;
    lng?: number;
    address?: string;
  }) =>
    apiRequest<ResolveClusterResult>(
      `/customers/resolve-cluster${buildQuery(params as Record<string, string | number | undefined>)}`
    ),

  get: (id: string) => apiRequest<CustomerDetail>(`/customers/${id}`),

  create: (data: CreateCustomerInput) =>
    apiRequest<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateCustomerInput) =>
    apiRequest<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/customers/${id}`, { method: "DELETE" }),
};

export const salesApi = {
  record: (data: RecordSaleInput) =>
    apiRequest<Sale>("/sales", { method: "POST", body: JSON.stringify(data) }),

  get: (id: string) => apiRequest<Sale>(`/sales/${id}`),
};
