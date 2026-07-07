import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type { CreatePurchaseInput, PurchaseOrder } from "@/types/purchase";

export const purchaseApi = {
  list: (params: PaginatedParams & { status?: string; branchId?: string; supplierId?: string } = {}) =>
    apiRequestWithMeta<PurchaseOrder[]>(`/purchases${buildQuery(params as Record<string, string | number | undefined>)}`),

  get: (id: string) => apiRequest<PurchaseOrder & { grns?: unknown[] }>(`/purchases/${id}`),

  create: (data: CreatePurchaseInput) =>
    apiRequest<PurchaseOrder>("/purchases", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<CreatePurchaseInput>) =>
    apiRequest<PurchaseOrder>(`/purchases/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  submit: (id: string) =>
    apiRequest<PurchaseOrder>(`/purchases/${id}/submit`, { method: "POST" }),

  approve: (id: string) =>
    apiRequest<PurchaseOrder>(`/purchases/${id}/approve`, { method: "POST" }),

  order: (id: string) =>
    apiRequest<PurchaseOrder>(`/purchases/${id}/order`, { method: "POST" }),

  markInTransit: (id: string) =>
    apiRequest<PurchaseOrder>(`/purchases/${id}/in-transit`, { method: "POST" }),

  receive: (id: string, items: { productId: string; quantityReceived: number }[], notes?: string) =>
    apiRequest<{ purchaseOrder: PurchaseOrder; grn: unknown }>(`/purchases/${id}/receive`, {
      method: "POST",
      body: JSON.stringify({ items, notes }),
    }),

  cancel: (id: string) =>
    apiRequest<PurchaseOrder>(`/purchases/${id}/cancel`, { method: "POST" }),

  amend: (id: string, items: import("@/types/purchase").AmendPurchaseItemInput[]) =>
    apiRequest<PurchaseOrder>(`/purchases/${id}/amend`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  sendToSupplier: (id: string) =>
    apiRequest<{ message: string; sentTo: string }>(`/purchases/${id}/send-to-supplier`, { method: "POST" }),
};
