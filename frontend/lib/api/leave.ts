import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";

export interface LeaveRequest {
  _id: string;
  employeeId: { _id: string; firstName: string; lastName: string; employeeId?: string };
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: string;
  rejectionReason?: string;
  attachmentUrl?: string;
}

export interface LeaveBalance {
  annual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
  emergency: { total: number; used: number; remaining: number };
  unpaid: { total: number; used: number; remaining: number };
}

export const leaveApi = {
  getBalance: (params: { year?: number } = {}) =>
    apiRequest<LeaveBalance>(`/leaves/balance${buildQuery(params)}`),

  request: (data: { type: string; startDate: string; endDate: string; reason: string }) =>
    apiRequest<LeaveRequest>("/leaves/request", { method: "POST", body: JSON.stringify(data) }),

  list: (params: { status?: string; fromDate?: string; toDate?: string; page?: number; limit?: number } = {}) =>
    apiRequestWithMeta<LeaveRequest[]>(`/leaves${buildQuery(params)}`),

  getCalendar: (params: { fromDate?: string; toDate?: string } = {}) =>
    apiRequest<LeaveRequest[]>(`/leaves/calendar${buildQuery(params)}`),

  approve: (id: string) =>
    apiRequest<LeaveRequest>(`/leaves/${id}/approve`, { method: "PUT" }),

  reject: (id: string, rejectionReason: string) =>
    apiRequest<LeaveRequest>(`/leaves/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ rejectionReason }),
    }),
};
