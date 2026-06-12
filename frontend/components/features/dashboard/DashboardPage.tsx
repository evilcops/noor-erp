"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar, Clock, FileWarning, Plus, TrendingUp, UserPlus, Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/hooks/usePermissions";
import { dashboardApi } from "@/lib/api/dashboard";

export function DashboardPage() {
  const { can } = usePermissions();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.getHrSummary(),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalEmployees: 0, presentToday: 0, onLeaveToday: 0, lateToday: 0, pendingLeaveRequests: 0,
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="HR overview — employees, attendance, recruitment, and upcoming events."
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {isError ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          Could not load live data. Ensure the backend API is running at localhost:5000.
          <Button variant="ghost" onClick={() => refetch()} className="ml-2">Retry</Button>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard title="Total Employees" value={summary.totalEmployees} icon={Users} href="/employees" />
        <SummaryCard title="Present Today" value={summary.presentToday} subtitle={summary.totalEmployees ? `${Math.round((summary.presentToday / summary.totalEmployees) * 100)}%` : undefined} icon={Clock} href="/attendance" />
        <SummaryCard title="On Leave" value={summary.onLeaveToday} icon={Calendar} href="/leave" />
        <SummaryCard title="Late Today" value={summary.lateToday} icon={Clock} href="/attendance" />
        <SummaryCard title="Pending Leave" value={summary.pendingLeaveRequests} icon={Calendar} href="/leave" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-brand" />
            Recruitment Pipeline
          </h2>
          {data?.recruitmentByStatus && Object.keys(data.recruitmentByStatus).length ? (
            <div className="space-y-2">
              {Object.entries(data.recruitmentByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <StatusBadge status={status} />
                  <div className="flex-1 h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (count / (data.recentCandidates.length || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-medium w-6">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No candidates yet.</p>
          )}
          <h3 className="mt-6 mb-2 text-sm font-medium text-muted-foreground">Recent Candidates</h3>
          <ul className="space-y-2">
            {(data?.recentCandidates ?? []).map((c) => (
              <li key={c._id} className="flex justify-between text-sm">
                <span>{c.candidateName} — {c.position}</span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{data?.pendingInterviews ?? 0} interviews scheduled</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileWarning className="h-5 w-5 text-warning" />
            Upcoming & Due
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between rounded-lg border border-border px-3 py-2">
              <span>Document expirations (30 days)</span>
              <span className="font-medium text-warning">{data?.expiringDocuments ?? 0}</span>
            </li>
            <li className="flex justify-between rounded-lg border border-border px-3 py-2">
              <span>Performance reviews due</span>
              <span className="font-medium">{data?.reviewsDue ?? 0}</span>
            </li>
          </ul>

          <h3 className="mt-6 mb-3 text-sm font-medium">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/attendance"><Button variant="secondary"><Clock className="mr-2 h-4 w-4" />Attendance</Button></Link>
            <Link href="/leave"><Button variant="secondary"><Calendar className="mr-2 h-4 w-4" />Request Leave</Button></Link>
            {can("employee:create") ? (
              <Link href="/employees"><Button variant="secondary"><UserPlus className="mr-2 h-4 w-4" />Add Employee</Button></Link>
            ) : null}
            {can("recruitment:edit") ? (
              <Link href="/recruitment"><Button variant="secondary"><Plus className="mr-2 h-4 w-4" />Recruitment</Button></Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  title, value, subtitle, icon: Icon, href,
}: {
  title: string; value: number; subtitle?: string; icon: React.ComponentType<{ className?: string }>; href: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
          {subtitle ? <p className="text-xs text-brand">{subtitle}</p> : null}
        </div>
        <Icon className="h-8 w-8 text-brand/60" />
      </div>
    </Link>
  );
}
