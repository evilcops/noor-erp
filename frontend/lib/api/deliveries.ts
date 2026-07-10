import { apiRequest, apiRequestWithMeta } from "./client";
import type { AssignDeliveryInput, Delivery, DispatchDashboard } from "@/types/delivery";
import type { Rider, RiderRoutePlan, RiderRouteSummary } from "@/types/rider";

export const deliveryApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    riderId?: string;
    branchId?: string;
    scheduledDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.riderId) q.set("riderId", params.riderId);
    if (params?.branchId) q.set("branchId", params.branchId);
    if (params?.scheduledDate) q.set("scheduledDate", params.scheduledDate);
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    const qs = q.toString();
    return apiRequestWithMeta<Delivery[]>(`/deliveries${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => apiRequest<Delivery>(`/deliveries/${id}`),

  assign: (id: string, data: AssignDeliveryInput) =>
    apiRequest<Delivery>(`/deliveries/${id}/assign`, { method: "POST", body: JSON.stringify(data) }),

  autoAssign: (id: string) =>
    apiRequest<Delivery>(`/deliveries/${id}/auto-assign`, { method: "POST" }),

  updateStatus: (
    id: string,
    data: {
      status: string;
      failureReason?: string;
      notes?: string;
      cashCollected?: number;
      cashHandedOver?: boolean;
      rescheduleTimeSlotStart?: string;
      rescheduleTimeSlotEnd?: string;
    }
  ) =>
    apiRequest<Delivery>(`/deliveries/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  dashboard: (params?: { branchId?: string; dateFrom?: string; dateTo?: string }) => {
    const q = new URLSearchParams();
    if (params?.branchId) q.set("branchId", params.branchId);
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    const qs = q.toString();
    return apiRequest<DispatchDashboard>(`/deliveries/dashboard${qs ? `?${qs}` : ""}`);
  },

  optimizeRoute: (riderId: string, scheduledDate: string, deliveryIds: string[]) =>
    apiRequest<{ journey: unknown; optimizedRoute: unknown; warehouse: { lat: number; lng: number } }>(
      "/deliveries/optimize-route",
      { method: "POST", body: JSON.stringify({ riderId, scheduledDate, deliveryIds }) }
    ),

  sendWhatsApp: (id: string) =>
    apiRequest<{ whatsappLink: string; message: string }>(`/deliveries/${id}/send-whatsapp`, { method: "POST" }),

  myDeliveries: () =>
    apiRequest<{
      rider: Rider;
      deliveries: Delivery[];
      journey: unknown;
      route: RiderRoutePlan | null;
      previousRoute?: RiderRouteSummary | null;
      routeLocked?: boolean;
      canAcceptMoreOrders?: boolean;
      runNumber?: string;
      pathSummary?: string | null;
    }>("/rider-app/deliveries"),

  startJourney: () => apiRequest<{ rider: Rider }>("/rider-app/route/start", { method: "POST" }),

  endJourney: () =>
    apiRequest<{
      rider: Rider;
      completed?: boolean;
      assigned?: number;
      runNumber?: string;
      message?: string;
      remainingStops?: number;
    }>("/rider-app/journey/end", { method: "POST" }),

  startShift: () => apiRequest<{ rider: Rider }>("/rider-app/shift/start", { method: "POST" }),

  endShift: () => apiRequest<{ rider: Rider }>("/rider-app/shift/end", { method: "POST" }),

  startRoute: () =>
    apiRequest<{
      rider: Rider;
      firstStop?: Delivery;
      route?: RiderRoutePlan | null;
      stopsDispatched?: number;
    }>("/rider-app/route/start", { method: "POST" }),

  updateMyLocation: (lat: number, lng: number) =>
    apiRequest<{ lat: number; lng: number }>("/rider-app/location", {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    }),

  predictPromise: (data: {
    companyId: string;
    branchId: string;
    coordinates?: { lat: number; lng: number };
    totalAmount: number;
    quantity: number;
    earliestAcceptableAt?: string;
    orderSource?: string;
  }) =>
    apiRequest<{
      promisedWindowStart: string;
      promisedWindowEnd: string;
      preparationMinutes: number;
      warehouseReadyAt: string;
      travelTimeMinutes: number;
      estimatedDeliveryAt: string;
      alternativeWindows: { start: string; end: string }[];
      clusterId?: string;
      provisionalRiderId?: string;
    }>("/deliveries/predict-promise", { method: "POST", body: JSON.stringify(data) }),

  fleetSnapshot: (branchId: string, params?: { dateFrom?: string; dateTo?: string }) => {
    const q = new URLSearchParams({ branchId });
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    return apiRequest<{
      totalDeliveries: number;
      activeRiders: number;
      bySource: Record<string, number>;
      byCluster: { clusterId: string; code: string; count: number; totalValue: number }[];
      riders: { riderId: string; riderCode: string; status: string; predictedReturnAt?: string; activeStops: number }[];
      activeRuns: { runId: string; runNumber: string; riderCode: string; clusterIds: string[]; stops: number; deliveriesPerKm?: number }[];
    }>(`/dispatch/snapshot?${q.toString()}`);
  },

  processStandingOrders: (branchId: string) =>
    apiRequest<{ processed: number; saleNumbers: string[] }>("/dispatch/standing-orders/process", {
      method: "POST",
      body: JSON.stringify({ branchId }),
    }),

  riderBreakdown: (riderId: string) =>
    apiRequest<{ reassigned: number }>("/dispatch/rider-breakdown", {
      method: "POST",
      body: JSON.stringify({ riderId }),
    }),

  rescheduleWindows: (id: string, earliestAcceptableAt?: string) =>
    apiRequest<{
      alternativeWindows: { start: string; end: string }[];
      promisedWindowStart: string;
      promisedWindowEnd: string;
    }>(`/deliveries/${id}/reschedule-windows`, {
      method: "POST",
      body: JSON.stringify({ earliestAcceptableAt }),
    }),

  confirmPromise: (id: string, promisedWindowStart: string, promisedWindowEnd: string) =>
    apiRequest<Delivery>(`/deliveries/${id}/confirm-promise`, {
      method: "POST",
      body: JSON.stringify({ promisedWindowStart, promisedWindowEnd }),
    }),

  warehouseStatus: (id: string, status: string) =>
    apiRequest<Delivery>(`/deliveries/${id}/warehouse-status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  optimiseFleet: (branchId: string) =>
    apiRequest<{ optimised: unknown[] }>("/dispatch/optimise", {
      method: "POST",
      body: JSON.stringify({ branchId }),
    }),

  demandQueue: (branchId: string) =>
    apiRequest<Delivery[]>(`/dispatch/queue?branchId=${branchId}`),
};
