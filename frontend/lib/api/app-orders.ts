import { apiRequest, apiRequestWithMeta, buildQuery } from "./client";

export type AppOrder = {
  _id: string;
  saleNumber: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  notes?: string;
  source?: string;
  status?: "open" | "completed" | "cancelled";
  customerId?:
    | string
    | { _id: string; name?: string; phone?: string; email?: string; address?: string; area?: string };
  branchId?: string | { _id: string; name?: string; code?: string };
  items?: {
    productId: string | { _id: string; name: string; sku: string; images?: string[] };
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  delivery?: {
    _id: string;
    deliveryNumber: string;
    status: string;
    warehouseStatus?: string;
    orderSource?: string;
    promisedWindowStart?: string;
    promisedWindowEnd?: string;
    estimatedArrival?: string;
    travelTimeMinutes?: number;
    assignmentLocked?: boolean;
  } | null;
  riderAssigned?: boolean;
  riderCode?: string;
  riderName?: string;
  canCancel?: boolean;
};

export const appOrdersApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
    deliveryStatus?: string;
  }) =>
    apiRequestWithMeta<AppOrder[]>(
      `/app-orders${buildQuery(params as Record<string, string | number | undefined>)}`
    ),

  cancel: (saleId: string, reason?: string) =>
    apiRequest<{ _id: string; saleNumber: string; status: string }>(
      `/app-orders/${saleId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      }
    ),
};
