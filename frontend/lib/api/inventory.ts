import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type { CreateStockTransferInput, StockTransfer } from "@/types/purchase";
import type { InventoryDashboard, StockLevel, StockMovement } from "@/types/inventory";

export const inventoryApi = {
  listStock: (params: PaginatedParams & { branchId?: string; productId?: string; lowStock?: string } = {}) =>
    apiRequestWithMeta<StockLevel[]>(`/inventory${buildQuery(params as Record<string, string | number | undefined>)}`),

  movements: (params: PaginatedParams & { branchId?: string; productId?: string; type?: string; fromDate?: string; toDate?: string } = {}) =>
    apiRequestWithMeta<StockMovement[]>(`/inventory/movements${buildQuery(params as Record<string, string | number | undefined>)}`),

  lowStock: () => apiRequest<StockLevel[]>("/inventory/low-stock"),

  dashboard: (branchId?: string) =>
    apiRequest<InventoryDashboard>(`/inventory/dashboard${buildQuery({ branchId })}`),

  adjust: (data: {
    branchId: string;
    productId: string;
    quantity: number;
    type: "adjustment" | "damaged" | "returned" | "manual_correction";
    reason: string;
    notes?: string;
  }) => apiRequest<StockLevel>("/inventory", { method: "POST", body: JSON.stringify(data) }),
};

export const stockTransferApi = {
  list: (params: PaginatedParams & { status?: string; fromBranchId?: string; toBranchId?: string } = {}) =>
    apiRequestWithMeta<StockTransfer[]>(`/stock-transfers${buildQuery(params as Record<string, string | number | undefined>)}`),

  get: (id: string) => apiRequest<StockTransfer>(`/stock-transfers/${id}`),

  create: (data: CreateStockTransferInput) =>
    apiRequest<StockTransfer>("/stock-transfers", { method: "POST", body: JSON.stringify(data) }),

  approve: (id: string) =>
    apiRequest<StockTransfer>(`/stock-transfers/${id}/approve`, { method: "POST" }),

  reject: (id: string) =>
    apiRequest<StockTransfer>(`/stock-transfers/${id}/reject`, { method: "POST" }),

  dispatch: (id: string, items: { productId: string; quantityDispatched: number }[]) =>
    apiRequest<StockTransfer>(`/stock-transfers/${id}/dispatch`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  receive: (id: string, items: { productId: string; quantityReceived: number }[]) =>
    apiRequest<StockTransfer>(`/stock-transfers/${id}/receive`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  cancel: (id: string) =>
    apiRequest<StockTransfer>(`/stock-transfers/${id}/cancel`, { method: "POST" }),
};
