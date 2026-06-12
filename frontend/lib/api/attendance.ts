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
  locationIn?: { lat: number; lng: number; address?: string };
  correctionRequest?: {
    requestedTimeIn?: string;
    requestedTimeOut?: string;
    reason?: string;
    requestedAt?: string;
  };
}

export const attendanceApi = {
  checkIn: (data: { lat: number; lng: number; address?: string; notes?: string }) =>
    apiRequest<AttendanceRecord>("/attendance/check-in", { method: "POST", body: JSON.stringify(data) }),

  checkOut: (data: { lat: number; lng: number; address?: string; notes?: string }) =>
    apiRequest<AttendanceRecord>("/attendance/check-out", { method: "POST", body: JSON.stringify(data) }),

  getToday: () => apiRequest<AttendanceRecord[]>("/attendance/today"),

  getMy: (params: { fromDate?: string; toDate?: string; page?: number } = {}) =>
    apiRequestWithMeta<AttendanceRecord[]>(`/attendance/my${buildQuery(params)}`),

  getTeam: () => apiRequest<AttendanceRecord[]>("/attendance/team"),

  getReport: (params: { fromDate?: string; toDate?: string; branchId?: string; status?: string } = {}) =>
    apiRequest<AttendanceRecord[]>(`/attendance/report${buildQuery(params)}`),

  requestCorrection: (data: { attendanceId: string; requestedTimeIn?: string; requestedTimeOut?: string; reason: string }) =>
    apiRequest<AttendanceRecord>("/attendance/correction-request", { method: "POST", body: JSON.stringify(data) }),

  approveCorrection: (id: string, approved: boolean, rejectionReason?: string) =>
    apiRequest<AttendanceRecord>(`/attendance/correction/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ approved, rejectionReason }),
    }),
};
