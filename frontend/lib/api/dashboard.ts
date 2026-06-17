import { apiRequest } from "@/lib/api/client";
import { attendanceApi } from "@/lib/api/attendance";
import { employeeApi } from "@/lib/api/employees";
import { leaveApi } from "@/lib/api/leave";
import { recruitmentApi } from "@/lib/api/recruitment";
import type { ExpiringDocumentAlert } from "@/types/employee";

export interface HrSummary {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  lateToday: number;
  pendingLeaveRequests: number;
}

export interface DashboardData {
  summary: HrSummary;
  recruitmentByStatus: Record<string, number>;
  recentCandidates: Array<{ _id: string; candidateName: string; position: string; status: string; createdAt: string }>;
  pendingInterviews: number;
  upcomingHolidays: Array<{ name: string; date: string }>;
  expiringDocuments: number;
  expiringDocumentAlerts: ExpiringDocumentAlert[];
  reviewsDue: number;
}

export const dashboardApi = {
  async getHrSummary(): Promise<DashboardData> {
    const [employees, todayAttendance, leaves, candidates, expiring] = await Promise.all([
      employeeApi.getAll({ limit: 1 }),
      attendanceApi.getToday().catch(() => [] as Awaited<ReturnType<typeof attendanceApi.getToday>>),
      leaveApi.list({ status: "pending", limit: 100 }).catch(() => ({ data: [] })),
      recruitmentApi.getCandidates({ limit: 100 }).catch(() => ({ data: [] })),
      // 274 days = 9 months (widest alert window, for passport/driving_license/mulkiya)
      employeeApi.getExpiringDocuments(274).catch(() => []),
    ]);

    const presentToday = todayAttendance.filter((a) => a.timeIn).length;
    const lateToday = todayAttendance.filter((a) => a.isLate).length;
    const onLeaveToday = todayAttendance.filter((a) => a.status === "on_leave").length;

    const recruitmentByStatus: Record<string, number> = {};
    candidates.data.forEach((c) => {
      recruitmentByStatus[c.status] = (recruitmentByStatus[c.status] ?? 0) + 1;
    });

    const pendingInterviews = candidates.data.filter(
      (c) => c.status === "interview_scheduled"
    ).length;

    const alerts = Array.isArray(expiring) ? (expiring as ExpiringDocumentAlert[]) : [];

    return {
      summary: {
        totalEmployees: employees.meta?.total ?? 0,
        presentToday,
        onLeaveToday,
        lateToday,
        pendingLeaveRequests: leaves.data?.length ?? 0,
      },
      recruitmentByStatus,
      recentCandidates: candidates.data.slice(0, 5).map((c) => ({
        _id: c._id,
        candidateName: c.candidateName,
        position: c.position,
        status: c.status,
        createdAt: c.createdAt,
      })),
      pendingInterviews,
      upcomingHolidays: [],
      expiringDocuments: alerts.length,
      expiringDocumentAlerts: alerts,
      reviewsDue: 0,
    };
  },

  getRecentActivity: () =>
    apiRequest<unknown[]>("/admin/audit-logs?limit=10").catch(() => []),
};
