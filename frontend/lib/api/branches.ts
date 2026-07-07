import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { DeliveryExpandedRegion } from "@/lib/compass-directions";
import type { CreateBranchInput, Branch, UpdateBranchInput } from "@/types/branch";
import type { PaginatedParams } from "@/types/api";

export type { Branch } from "@/types/branch";

export const branchApi = {
  getAll: (params: PaginatedParams & { companyId?: string; type?: "main" | "sub"; parentBranchId?: string } = {}) =>
    apiRequestWithMeta<Branch[]>(`/branches${buildQuery(params as Record<string, string | number | undefined>)}`),

  getById: (id: string) => apiRequest<Branch>(`/branches/${id}`),

  create: (data: CreateBranchInput) =>
    apiRequest<Branch>("/branches", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateBranchInput) =>
    apiRequest<Branch>(`/branches/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/branches/${id}`, { method: "DELETE" }),

  regenerateClusters: (
    id: string,
    options?: {
      sectorCount?: number;
      deliveryRadiusKm?: number;
      expandedRegions?: DeliveryExpandedRegion[] | null;
    }
  ) =>
    apiRequest<{
      count: number;
      clusters: unknown[];
      sectorCount?: number;
      deliveryRadiusKm?: number;
      deliveryExpandedRegions?: DeliveryExpandedRegion[];
    }>(`/branches/${id}/regenerate-clusters`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    }),
};
