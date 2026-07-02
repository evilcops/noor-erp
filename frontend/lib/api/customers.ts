import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type { Customer, CustomerDetail, RecordSaleInput, Sale } from "@/types/customer";

export const customerApi = {
  list: (params: PaginatedParams & { search?: string } = {}) =>
    apiRequestWithMeta<Customer[]>(`/customers${buildQuery(params as Record<string, string | number | undefined>)}`),

  get: (id: string) => apiRequest<CustomerDetail>(`/customers/${id}`),
};

export const salesApi = {
  record: (data: RecordSaleInput) =>
    apiRequest<Sale>("/sales", { method: "POST", body: JSON.stringify(data) }),

  get: (id: string) => apiRequest<Sale>(`/sales/${id}`),
};
