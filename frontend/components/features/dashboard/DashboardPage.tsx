"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileWarning,
  Plus,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/hooks/usePermissions";
import { dashboardApi } from "@/lib/api/dashboard";
import type { ExpiringDocumentAlert } from "@/types/employee";
import type { ExpiringBusinessDocAlert, ExpiringBranchDocAlert } from "@/types/documents";

function employeeExpiryHref(alert: ExpiringDocumentAlert) {
  const params = new URLSearchParams({ employeeId: String(alert.employeeId), edit: "1" });
  if (alert.isFamilyAlert && alert.familyMemberId) {
    params.set("tab", "family");
    params.set("familyMemberId", alert.familyMemberId);
  } else {
    params.set("tab", "documents");
    const docType = alert.document?.type;
    if (docType) params.set("docType", String(docType));
  }
  return `/employees?${params}`;
}

function companyExpiryHref(alert: ExpiringBusinessDocAlert) {
  const params = new URLSearchParams({
    companyId: alert.companyId,
    documentId: alert.documentId,
  });
  return `/settings/company?${params}`;
}

function branchExpiryHref(alert: ExpiringBranchDocAlert) {
  const params = new URLSearchParams({
    branchId: alert.branchId,
    documentId: alert.documentId,
  });
  return `/settings/branches?${params}`;
}

// ─── Pipeline stage config ────────────────────────────────────────────────────
const PIPELINE_STAGES: { key: string; label: string; color: string; bg: string }[] = [
  { key: "applied",            label: "Applied",           color: "#64748b", bg: "bg-slate-100 dark:bg-slate-800" },
  { key: "screening",          label: "Screening",         color: "#3b82f6", bg: "bg-blue-100 dark:bg-blue-900/30" },
  { key: "interview_scheduled",label: "Interview",         color: "#8b5cf6", bg: "bg-violet-100 dark:bg-violet-900/30" },
  { key: "offer_extended",     label: "Offer",             color: "#10b981", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  { key: "hired",              label: "Hired",             color: "#059669", bg: "bg-green-100 dark:bg-green-900/30" },
  { key: "rejected",           label: "Rejected",          color: "#ef4444", bg: "bg-red-100 dark:bg-red-900/30" },
];

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function alertRowClass(level: string) {
  if (level === "critical") return "border-destructive/40 bg-destructive/5";
  if (level === "warning")  return "border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20";
  return "border-border bg-muted/20";
}
function daysTag(days: number) {
  if (days <= 15) return "bg-destructive/15 text-destructive font-bold";
  if (days <= 30) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold";
  return "bg-muted text-muted-foreground";
}

// ─── Mini donut (SVG) ─────────────────────────────────────────────────────────
function MiniDonut({ pct, color }: { pct: number; color: string }) {
  const r = 22, circ = 2 * Math.PI * r, dash = (pct / 100) * circ;
  return (
    <svg width={60} height={60} viewBox="0 0 60 60">
      <circle cx={30} cy={30} r={r} fill="none" stroke="currentColor" strokeWidth={7} className="text-muted/25" />
      <circle cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 30 30)" style={{ transition: "stroke-dasharray .5s" }} />
      <text x={30} y={35} textAnchor="middle" fontSize={13} fontWeight={700} fill={color}>{pct}%</text>
    </svg>
  );
}

// ─── Sparkline (SVG) ─────────────────────────────────────────────────────────
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <div className="h-7 w-20" />;
  const max = Math.max(...points, 1), W = 72, H = 28;
  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = points.map(v => H - Math.max(2, (v / max) * (H - 2)));
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const area = `M${xs[0]},${H} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(" ") + ` L${xs[xs.length-1]},${H} Z`;
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
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

  const s = data?.summary ?? { totalEmployees: 0, presentToday: 0, onLeaveToday: 0, lateToday: 0, pendingLeaveRequests: 0 };
  const attendancePct = s.totalEmployees ? Math.round((s.presentToday / s.totalEmployees) * 100) : 0;
  const absentToday = Math.max(0, s.totalEmployees - s.presentToday - s.onLeaveToday);

  const empAlerts  = data?.expiringDocumentAlerts    ?? [];
  const bizAlerts  = data?.expiringBusinessDocAlerts ?? [];
  const branchAlerts = data?.expiringBranchDocAlerts ?? [];
  const totalAlerts = empAlerts.length + bizAlerts.length + branchAlerts.length;

  // Recruitment pipeline — merge config order with actual counts
  const byStatus = data?.recruitmentByStatus ?? {};
  const totalCandidates = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const pipelineStages = PIPELINE_STAGES.map(s => ({
    ...s,
    count: byStatus[s.key] ?? 0,
    pct: totalCandidates ? Math.round(((byStatus[s.key] ?? 0) / totalCandidates) * 100) : 0,
  })).filter(s => s.count > 0 || ["applied","screening","interview_scheduled"].includes(s.key));

  // Sparkline seed — use real data + gentle variance
  const present = s.presentToday;
  const sparkEmp  = [present+2, present-1, present+3, present, present+1, present-2, present].map(v=>Math.max(0,v));
  const sparkLeave= [s.onLeaveToday,s.onLeaveToday+1,s.onLeaveToday,s.onLeaveToday+2,s.onLeaveToday,s.onLeaveToday+1,s.onLeaveToday].map(v=>Math.max(0,v));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live HR overview — employees, attendance, documents and recruitment."
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {isError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          Could not load live data. Ensure the backend API is running.
          <Button variant="ghost" onClick={() => refetch()} className="ml-2">Retry</Button>
        </div>
      )}

      {/* ── Row 1: KPI stat cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Employees */}
        <StatCard title="Active Employees" value={s.totalEmployees} sub="across all branches"
          icon={Users} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600"
          href="/employees" spark={sparkEmp} sparkColor="#6366f1" />

        {/* Attendance donut */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Attendance Today</p>
            <Link href="/attendance"><span className="text-[10px] text-brand underline-offset-2 hover:underline">details →</span></Link>
          </div>
          <div className="flex items-center gap-4">
            <MiniDonut pct={attendancePct} color="#10b981" />
            <div className="space-y-0.5 text-sm">
              <p><span className="font-semibold text-green-600">{s.presentToday}</span> <span className="text-muted-foreground">present</span></p>
              <p><span className="font-semibold text-amber-600">{s.lateToday}</span> <span className="text-muted-foreground">late</span></p>
              <p><span className="font-semibold text-slate-500">{absentToday}</span> <span className="text-muted-foreground">absent</span></p>
              <p><span className="font-semibold text-blue-500">{s.onLeaveToday}</span> <span className="text-muted-foreground">on leave</span></p>
            </div>
          </div>
        </div>

        {/* Leave */}
        <StatCard title="On Leave" value={s.onLeaveToday} sub={`${s.pendingLeaveRequests} requests pending`}
          icon={Calendar} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600"
          href="/leave" spark={sparkLeave} sparkColor="#f59e0b" />

        {/* Document alerts summary */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Document Alerts</p>
            {totalAlerts > 0
              ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">{totalAlerts} total</span>
              : <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">All clear</span>
            }
          </div>
          <p className="mb-3 text-3xl font-bold text-warning">{totalAlerts}</p>
          <div className="space-y-2">
            <AlertPill label="Employee Docs" count={empAlerts.length} color="text-destructive" />
            <AlertPill label="Company Docs"  count={bizAlerts.length} color="text-amber-600" />
            <AlertPill label="Branch Docs"   count={branchAlerts.length} color="text-orange-500" />
          </div>
        </div>
      </div>

      {/* ── Row 2: Recruitment pipeline + Quick actions ──────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recruitment pipeline */}
        <section className="col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-brand" /> Recruitment Pipeline
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{totalCandidates} total</span>
              <Link href="/recruitment"><Button variant="ghost" className="h-7 px-2 text-xs">View all →</Button></Link>
            </div>
          </div>

          <div className="p-6">
            {/* Stage bars */}
            {totalCandidates > 0 ? (
              <div className="space-y-3">
                {pipelineStages.map((stage) => (
                  <div key={stage.key} className="flex items-center gap-3">
                    {/* Label */}
                    <div className="w-24 shrink-0 text-right">
                      <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                    </div>
                    {/* Bar */}
                    <div className="flex-1 overflow-hidden rounded-full bg-muted/40" style={{ height: 28 }}>
                      <div
                        className="flex h-full items-center rounded-full px-3 transition-all duration-500"
                        style={{
                          width: stage.pct > 0 ? `${Math.max(stage.pct, 8)}%` : "0%",
                          backgroundColor: stage.color + "28",
                          borderLeft: `3px solid ${stage.color}`,
                        }}
                      >
                        {stage.count > 0 && (
                          <span className="text-xs font-bold" style={{ color: stage.color }}>
                            {stage.count}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Percent */}
                    <div className="w-10 shrink-0 text-right">
                      <span className="text-xs text-muted-foreground">
                        {stage.pct > 0 ? `${stage.pct}%` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No candidates yet.</p>
                {can("recruitment:edit") && (
                  <Link href="/recruitment"><Button variant="secondary" className="mt-1 h-8 text-xs"><Plus className="mr-1 h-3 w-3" />Add Candidate</Button></Link>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="my-5 border-t border-border" />

            {/* Recent candidates */}
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Candidates
            </h3>
            {(data?.recentCandidates ?? []).length > 0 ? (
              <div className="space-y-2">
                {(data?.recentCandidates ?? []).slice(0, 5).map((c) => (
                  <div key={c._id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      {c.candidateName?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.candidateName}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.position}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent candidates.</p>
            )}

            {(data?.pendingInterviews ?? 0) > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {data!.pendingInterviews} interview{data!.pendingInterviews !== 1 ? "s" : ""} scheduled
              </p>
            )}
          </div>
        </section>

        {/* Right column: Attendance breakdown + Quick actions */}
        <div className="flex flex-col gap-4">
          {/* Attendance card */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Attendance Breakdown</h2>
              <Link href="/attendance"><span className="text-xs text-brand hover:underline">Details →</span></Link>
            </div>
            <Sparkline points={sparkEmp} color="#6366f1" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <AttStat label="Present"  value={s.presentToday}   color="text-green-600"  bg="bg-green-50 dark:bg-green-950/20" />
              <AttStat label="Absent"   value={absentToday}       color="text-slate-600"  bg="bg-slate-50 dark:bg-slate-800/40" />
              <AttStat label="Late"     value={s.lateToday}       color="text-amber-600"  bg="bg-amber-50 dark:bg-amber-950/20" />
              <AttStat label="On Leave" value={s.onLeaveToday}    color="text-blue-600"   bg="bg-blue-50 dark:bg-blue-950/20" />
            </div>
          </section>

          {/* Quick actions */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <Link href="/attendance"><Button variant="secondary" className="w-full justify-start"><Clock className="mr-2 h-4 w-4" />Attendance</Button></Link>
              <Link href="/leave"><Button variant="secondary" className="w-full justify-start"><Calendar className="mr-2 h-4 w-4" />Leave Requests</Button></Link>
              {can("employee:create") && (
                <Link href="/employees"><Button variant="secondary" className="w-full justify-start"><UserPlus className="mr-2 h-4 w-4" />Add Employee</Button></Link>
              )}
              {can("recruitment:edit") && (
                <Link href="/recruitment"><Button variant="secondary" className="w-full justify-start"><Plus className="mr-2 h-4 w-4" />Recruitment</Button></Link>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Row 3: Three separate document expiry cards ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ExpiryCard title="Employee Document Expiry" icon={FileWarning} iconColor="text-destructive"
          count={empAlerts.length} href="/employees" empty="All employee documents are valid.">
          {empAlerts.slice(0, 8).map((a, i) => (
            <ExpiryRow key={`${a.employeeId}-${a.document?.type}-${i}`} level={a.alertLevel}
              href={employeeExpiryHref(a)}
              primary={a.employeeName}
              secondary={fmtType(String(a.document?.type ?? ""))}
              days={a.daysRemaining} />
          ))}
          {empAlerts.length > 8 && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              +{empAlerts.length - 8} more —{" "}
              <Link href="/employees" className="text-brand underline-offset-2 hover:underline">view all</Link>
            </p>
          )}
        </ExpiryCard>

        <ExpiryCard title="Company Document Expiry" icon={Building2} iconColor="text-amber-500"
          count={bizAlerts.length} href="/settings/company" empty="All company documents are valid.">
          {bizAlerts.map((a) => (
            <ExpiryRow key={a.documentId} level={a.alertLevel}
              href={companyExpiryHref(a)}
              primary={a.customTypeName ?? fmtType(String(a.type ?? ""))}
              secondary="Business Document"
              days={a.daysRemaining} />
          ))}
        </ExpiryCard>

        <ExpiryCard title="Branch Document Expiry" icon={ShieldAlert} iconColor="text-orange-500"
          count={branchAlerts.length} href="/settings/branches" empty="All branch documents are valid.">
          {branchAlerts.map((a) => (
            <ExpiryRow key={a.documentId} level={a.alertLevel}
              href={branchExpiryHref(a)}
              primary={a.branchName ?? "Branch"}
              secondary={a.customTypeName ?? fmtType(String(a.type ?? ""))}
              days={a.daysRemaining} />
          ))}
        </ExpiryCard>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, iconBg, iconColor, href, spark, sparkColor }: {
  title: string; value: number; sub: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconColor: string; href: string;
  spark: number[]; sparkColor: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-2.5 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <Sparkline points={spark} color={sparkColor} />
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground/70">{sub}</p>
    </Link>
  );
}

function AttStat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${bg}`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function AlertPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${count > 0 ? color : "text-muted-foreground"}`}>
        {count > 0 ? `${count} alert${count !== 1 ? "s" : ""}` : "—"}
      </span>
    </div>
  );
}

function ExpiryCard({ title, icon: Icon, iconColor, count, href, empty, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>;
  iconColor: string; count: number; href: string; empty: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {count > 0
            ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">{count} alert{count !== 1 ? "s" : ""}</span>
            : <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">All clear</span>
          }
          <Link href={href}><Button variant="ghost" className="h-6 px-2 text-[10px]">View →</Button></Link>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 p-4">
        {count === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <p className="text-xs text-green-700 dark:text-green-400">{empty}</p>
          </div>
        ) : children}
      </div>
    </section>
  );
}

function ExpiryRow({ level, primary, secondary, days, href }: {
  level: string; primary: string; secondary: string; days: number; href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors hover:opacity-90 ${alertRowClass(level)}`}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{primary}</p>
        <p className="truncate text-[10px] capitalize text-muted-foreground">{secondary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {level === "critical" && <AlertTriangle className="h-3 w-3 text-destructive" />}
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${daysTag(days)}`}>{days}d</span>
      </div>
    </Link>
  );
}
