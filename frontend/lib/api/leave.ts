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

export interface LeaveInput {
  employeeId?: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status?: string;
  attachmentUrl?: string;
}

export const leaveApi = {
  getBalance: (params: { employeeId?: string; year?: number } = {}) =>
    apiRequest<LeaveBalance>(`/leaves/balance${buildQuery(params)}`),

  request: (data: LeaveInput) =>
    apiRequest<LeaveRequest>("/leaves/request", { method: "POST", body: JSON.stringify(data) }),

  list: (params: {
    status?: string;
    branchId?: string;
    employeeId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    apiRequestWithMeta<LeaveRequest[]>(`/leaves${buildQuery(params)}`),

  getById: (id: string) => apiRequest<LeaveRequest>(`/leaves/${id}`),

  update: (id: string, data: Partial<LeaveInput>) =>
    apiRequest<LeaveRequest>(`/leaves/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/leaves/${id}`, { method: "DELETE" }),

  getCalendar: (params: { branchId?: string; employeeId?: string; fromDate?: string; toDate?: string } = {}) =>
    apiRequest<LeaveRequest[]>(`/leaves/calendar${buildQuery(params)}`),

  approve: (id: string) =>
    apiRequest<LeaveRequest>(`/leaves/${id}/approve`, { method: "PUT" }),

  reject: (id: string, rejectionReason: string) =>
    apiRequest<LeaveRequest>(`/leaves/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ rejectionReason }),
    }),
};
