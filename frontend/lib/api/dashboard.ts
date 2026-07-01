import { apiRequest } from "@/lib/api/client";
import { attendanceApi } from "@/lib/api/attendance";
import { employeeApi } from "@/lib/api/employees";
import { leaveApi } from "@/lib/api/leave";
import { recruitmentApi } from "@/lib/api/recruitment";
import { businessDocApi } from "@/lib/api/businessDocuments";
import { branchDocApi } from "@/lib/api/branchDocuments";
import type { ExpiringDocumentAlert } from "@/types/employee";
import type { ExpiringBusinessDocAlert, ExpiringBranchDocAlert } from "@/types/documents";

export interface HrSummary {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  lateToday: number;
  pendingLeaveRequests: number;
}

export interface DashboardAccess {
  employee: boolean;
  attendance: boolean;
  leave: boolean;
  recruitment: boolean;
  company: boolean;
  branch: boolean;
}

export interface DashboardData {
  summary: HrSummary;
  recruitmentByStatus: Record<string, number>;
  recentCandidates: Array<{ _id: string; candidateName: string; position: string; status: string; createdAt: string }>;
  pendingInterviews: number;
  upcomingHolidays: Array<{ name: string; date: string }>;
  expiringDocuments: number;
  expiringDocumentAlerts: ExpiringDocumentAlert[];
  expiringBusinessDocAlerts: ExpiringBusinessDocAlert[];
  expiringBranchDocAlerts: ExpiringBranchDocAlert[];
  reviewsDue: number;
}

export const dashboardApi = {
  async getHrSummary(access: DashboardAccess): Promise<DashboardData> {
    const needsAttendance = access.attendance || access.leave;
    const [employees, todayAttendance, leaves, candidates, expiring, expiringBiz, expiringBranch] =
      await Promise.all([
        access.employee
          ? employeeApi.getAll({ limit: 1, status: "active" })
          : Promise.resolve({ data: [], meta: { total: 0 } }),
        access.attendance
          ? attendanceApi.getToday().catch(() => [] as Awaited<ReturnType<typeof attendanceApi.getToday>>)
          : Promise.resolve([]),
        access.leave
          ? leaveApi.list({ status: "pending", limit: 100 }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        access.recruitment
          ? recruitmentApi.getCandidates({ limit: 100 }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        access.employee
          ? employeeApi.getExpiringDocuments(274).catch(() => [])
          : Promise.resolve([]),
        access.company
          ? businessDocApi.getExpiring().catch(() => [] as ExpiringBusinessDocAlert[])
          : Promise.resolve([]),
        access.branch
          ? branchDocApi.getExpiring().catch(() => [] as ExpiringBranchDocAlert[])
          : Promise.resolve([]),
      ]);

    const presentToday = access.attendance
      ? todayAttendance.filter((a) => a.timeIn).length
      : 0;
    const lateToday = access.attendance
      ? todayAttendance.filter((a) => a.isLate).length
      : 0;
    const onLeaveToday = access.attendance
      ? todayAttendance.filter((a) => a.status === "on_leave").length
      : 0;

    const recruitmentByStatus: Record<string, number> = {};
    if (access.recruitment) {
      candidates.data.forEach((c) => {
        recruitmentByStatus[c.status] = (recruitmentByStatus[c.status] ?? 0) + 1;
      });
    }

    const pendingInterviews = access.recruitment
      ? candidates.data.filter((c) => c.status === "interview_scheduled").length
      : 0;

    const alerts = access.employee && Array.isArray(expiring) ? (expiring as ExpiringDocumentAlert[]) : [];
    const bizAlerts = access.company && Array.isArray(expiringBiz) ? (expiringBiz as ExpiringBusinessDocAlert[]) : [];
    const branchAlerts = access.branch && Array.isArray(expiringBranch) ? (expiringBranch as ExpiringBranchDocAlert[]) : [];

    return {
      summary: {
        totalEmployees: access.employee ? (employees.meta?.total ?? 0) : 0,
        presentToday,
        onLeaveToday,
        lateToday,
        pendingLeaveRequests: access.leave ? (leaves.data?.length ?? 0) : 0,
      },
      recruitmentByStatus,
      recentCandidates: access.recruitment
        ? candidates.data.slice(0, 5).map((c) => ({
            _id: c._id,
            candidateName: c.candidateName,
            position: c.position,
            status: c.status,
            createdAt: c.createdAt,
          }))
        : [],
      pendingInterviews,
      upcomingHolidays: [],
      expiringDocuments: alerts.length + bizAlerts.length + branchAlerts.length,
      expiringDocumentAlerts: alerts,
      expiringBusinessDocAlerts: bizAlerts,
      expiringBranchDocAlerts: branchAlerts,
      reviewsDue: 0,
    };
  },

  getRecentActivity: () =>
    apiRequest<unknown[]>("/admin/audit-logs?limit=10").catch(() => []),
};
