import { apiRequest, apiRequestWithMeta } from "./client";

export interface DeliveryCluster {
  _id: string;
  companyId: string;
  branchId: string;
  code: string;
  name: string;
  center: { lat: number; lng: number };
  shape?: "circle" | "square" | "sector";
  radiusKm: number;
  cellSizeKm?: number;
  mainRadiusKm?: number;
  origin?: { lat: number; lng: number };
  sectorStartDeg?: number;
  sectorEndDeg?: number;
  sectorCount?: number;
  description?: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface CreateClusterFromSectorInput {
  companyId: string;
  branchId: string;
  sectorCount: number;
  sectorIndex: number;
  status?: "active" | "inactive";
}

export interface CreateClusterInput {
  companyId: string;
  branchId: string;
  code: string;
  name: string;
  center: { lat: number; lng: number };
  shape?: "circle" | "square" | "sector";
  radiusKm?: number;
  cellSizeKm?: number;
  mainRadiusKm?: number;
  description?: string;
  status?: "active" | "inactive";
}

export type CreateClusterPayload = CreateClusterFromSectorInput | CreateClusterInput;

export const clusterApi = {
  list: (params?: { page?: number; limit?: number; branchId?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.branchId) q.set("branchId", params.branchId);
    const qs = q.toString();
    return apiRequestWithMeta<DeliveryCluster[]>(`/clusters${qs ? `?${qs}` : ""}`);
  },

  create: (data: CreateClusterPayload) =>
    apiRequest<DeliveryCluster & { gridRepartitioned?: boolean }>("/clusters", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateClusterInput>) =>
    apiRequest<DeliveryCluster>(`/clusters/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};
