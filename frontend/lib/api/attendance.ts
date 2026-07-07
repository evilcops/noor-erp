import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";

export interface AttendanceRecord {
  _id: string;
  employeeId: { _id: string; firstName: string; lastName: string; employeeId: string; department?: string };
  date: string;
  timeIn?: string;
  timeOut?: string;
  totalHours?: number;
  status: string;
  isLate?: boolean;
  lateMinutes?: number;
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number;
  isMissedCheckout?: boolean;
  notes?: string;
  locationIn?: { lat: number; lng: number; address?: string };
  locationOut?: { lat: number; lng: number; address?: string };
  deviceInfo?: string;
  correctionRequest?: {
    requestedTimeIn?: string;
    requestedTimeOut?: string;
    reason?: string;
    requestedAt?: string;
    rejectionReason?: string;
  };
}

export interface AttendanceInput {
  employeeId: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  status?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  address?: string;
  deviceInfo?: string;
  isMissedCheckout?: boolean;
}

export const attendanceApi = {
  list: (params: {
    fromDate?: string;
    toDate?: string;
    branchId?: string;
    employeeId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    apiRequestWithMeta<AttendanceRecord[]>(`/attendance${buildQuery(params)}`),

  getById: (id: string) => apiRequest<AttendanceRecord>(`/attendance/${id}`),

  create: (data: AttendanceInput) =>
    apiRequest<AttendanceRecord>("/attendance", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<AttendanceInput>) =>
    apiRequest<AttendanceRecord>(`/attendance/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/attendance/${id}`, { method: "DELETE" }),

  checkIn: (data: { employeeId?: string; lat: number; lng: number; address?: string; notes?: string }) =>
    apiRequest<AttendanceRecord>("/attendance/check-in", { method: "POST", body: JSON.stringify(data) }),

  checkOut: (data: { employeeId?: string; lat: number; lng: number; address?: string; notes?: string }) =>
    apiRequest<AttendanceRecord>("/attendance/check-out", { method: "POST", body: JSON.stringify(data) }),

  getToday: () => apiRequest<AttendanceRecord[]>("/attendance/today"),

  getMy: (params: { fromDate?: string; toDate?: string; page?: number; limit?: number } = {}) =>
    apiRequestWithMeta<AttendanceRecord[]>(`/attendance/my${buildQuery(params)}`),

  getTeam: () => apiRequest<AttendanceRecord[]>("/attendance/team"),

  getReport: (params: {
    fromDate?: string;
    toDate?: string;
    branchId?: string;
    employeeId?: string;
    status?: string;
  } = {}) =>
    apiRequest<AttendanceRecord[]>(`/attendance/report${buildQuery(params)}`),

  requestCorrection: (data: { attendanceId: string; requestedTimeIn?: string; requestedTimeOut?: string; reason: string }) =>
    apiRequest<AttendanceRecord>("/attendance/correction-request", { method: "POST", body: JSON.stringify(data) }),

  approveCorrection: (id: string, approved: boolean, rejectionReason?: string) =>
    apiRequest<AttendanceRecord>(`/attendance/correction/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ approved, rejectionReason }),
    }),

  reportMissedCheckout: (id: string, data: { timeOut?: string; reason?: string }) =>
    apiRequest<AttendanceRecord>(`/attendance/${id}/missed-checkout`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
