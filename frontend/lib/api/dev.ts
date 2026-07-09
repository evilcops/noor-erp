import { apiRequest } from "./client";

export interface RuntimeSimulationStatus {
  running: boolean;
  config: {
    branchId: string;
    riderId?: string;
    dateFrom: string;
    dateTo: string;
    stepSize: number;
    intervalMs: number;
  } | null;
  lastTickAt: string | null;
}

export interface SimulateRiderGpsResult extends RuntimeSimulationStatus {
  action: "start" | "stop" | "reset" | "status";
  updated?: { riderId: string; riderCode: string; lat: number; lng: number }[];
}

export const devApi = {
  simulateRiderGps: (body: {
    branchId?: string;
    riderId?: string;
    dateFrom?: string;
    dateTo?: string;
    action?: "start" | "stop" | "reset" | "status";
    stepSize?: number;
    intervalMs?: number;
  }) =>
    apiRequest<SimulateRiderGpsResult>("/dev/simulate-rider-gps", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
