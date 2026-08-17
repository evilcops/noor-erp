import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";

export type RefusedItem = {
  _id: string;
  quantity: number;
  status: "with_rider" | "at_warehouse" | "restocked" | "discarded";
  refuseReason?: string;
  deliveryNumber?: string;
  saleNumber?: string;
  returnedAt?: string;
  restockedAt?: string;
  notes?: string;
  createdAt: string;
  productId?:
    | string
    | { _id: string; name?: string; sku?: string; images?: string[]; unitOfMeasure?: string };
  branchId?: string | { _id: string; name?: string; code?: string };
  riderId?:
    | string
    | {
        _id: string;
        riderCode?: string;
        employeeId?: { firstName?: string; lastName?: string };
      };
};

export const refusedItemsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    branchId?: string;
  }) =>
    apiRequestWithMeta<RefusedItem[]>(
      `/refused-items${buildQuery(params as Record<string, string | number | undefined>)}`
    ),

  restock: (id: string, notes?: string) =>
    apiRequest<RefusedItem>(`/refused-items/${id}/restock`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),

  discard: (id: string, notes?: string) =>
    apiRequest<RefusedItem>(`/refused-items/${id}/discard`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
};
