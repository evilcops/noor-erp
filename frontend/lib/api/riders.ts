import { apiRequest, apiRequestWithMeta } from "./client";
import type { Rider, RiderDetail, LiveRider } from "@/types/rider";

export const riderApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; branchId?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.branchId) q.set("branchId", params.branchId);
    const qs = q.toString();
    return apiRequestWithMeta<Rider[]>(`/riders${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => apiRequest<RiderDetail>(`/riders/${id}`),

  update: (id: string, data: Partial<Pick<Rider, "status" | "vehicleMake" | "vehicleModel" | "vehiclePlate" | "whatsappPhone">>) =>
    apiRequest<Rider>(`/riders/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  live: (branchId?: string) => {
    const q = branchId ? `?branchId=${branchId}` : "";
    return apiRequest<LiveRider[]>(`/riders/live${q}`);
  },

  updateLocation: (id: string, lat: number, lng: number) =>
    apiRequest<{ lat: number; lng: number }>(`/riders/${id}/location`, {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    }),
};
