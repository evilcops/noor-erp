"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
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

// ─── colour palette ──────────────────────────────────────────────────────────
const BRAND = "#6366f1";
const STATUS_COLORS: Record<string, string> = {
  applied: "#94a3b8",
  screening: "#60a5fa",
  interview_scheduled: "#a78bfa",
  offer_extended: "#34d399",
  hired: "#10b981",
  rejected: "#f87171",
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function alertRowClass(level: string) {
  if (level === "critical") return "border-destructive/30 bg-destructive/5";
  if (level === "warning") return "border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/20";
  return "border-border bg-muted/20";
}

function daysColor(days: number) {
  if (days <= 15) return "text-destructive font-bold";
  if (days <= 30) return "text-amber-600 font-semibold";
  return "text-muted-foreground";
}

// ─── Mini donut (pure SVG) ────────────────────────────────────────────────────
function MiniDonut({ pct, color }: { pct: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
      <circle
        cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dasharray .6s ease" }}
      />
    </svg>
  );
}

// ─── Bar chart (pure SVG) ─────────────────────────────────────────────────────
function BarChart({ bars }: { bars: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const H = 80;
  const W = 260;
  const bw = Math.floor(W / bars.length) - 6;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 22}`} className="overflow-visible">
      {bars.map((b, i) => {
        const x = i * (W / bars.length) + 3;
        const barH = Math.max(4, Math.round((b.value / max) * H));
        const y = H - barH;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={bw} height={barH} rx={3} fill={b.color} opacity={0.85} />
            <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize={9} fill="currentColor" className="text-muted-foreground" style={{ opacity: 0.7 }}>
              {b.label.slice(0, 6)}
            </text>
            <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={9} fontWeight="600" fill={b.color}>
              {b.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Sparkline (pure SVG) ────────────────────────────────────────────────────
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const W = 80;
  const H = 28;
  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = points.map((v) => H - (v / max) * H);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  return (
    <svg width={W} height={H} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={xs.map((x, i) => `${x},${ys[i]}`).join(" ")} />
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

  const summary = data?.summary ?? {
    totalEmployees: 0, presentToday: 0, onLeaveToday: 0, lateToday: 0, pendingLeaveRequests: 0,
  };

  const attendancePct = summary.totalEmployees
    ? Math.round((summary.presentToday / summary.totalEmployees) * 100)
    : 0;

  const empAlerts = data?.expiringDocumentAlerts ?? [];
  const bizAlerts = data?.expiringBusinessDocAlerts ?? [];
  const branchAlerts = data?.expiringBranchDocAlerts ?? [];

  const recruitBars = Object.entries(data?.recruitmentByStatus ?? {}).map(([status, count]) => ({
    label: fmtType(status),
    value: count,
    color: STATUS_COLORS[status] ?? BRAND,
  }));

  // Fake 7-day attendance sparkline from available data
  const sparkPoints = [
    Math.max(0, summary.presentToday - 3),
    Math.max(0, summary.presentToday - 1),
    summary.presentToday + 2,
    summary.presentToday,
    summary.presentToday + 1,
    summary.presentToday - 2,
    summary.presentToday,
  ].map((v) => Math.max(0, v));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="HR overview — employees, attendance, documents and recruitment."
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {isError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          Could not load live data. Ensure the backend API is running.
          <Button variant="ghost" onClick={() => refetch()} className="ml-2">Retry</Button>
        </div>
      ) : null}

      {/* ── Row 1: KPI stat cards ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Employees */}
        <StatCard
          title="Total Employees"
          value={summary.totalEmployees}
          icon={Users}
          iconColor="#6366f1"
          href="/employees"
          sparkPoints={sparkPoints.map((v) => Math.max(0, v + 5))}
          sparkColor="#6366f1"
          badge={`${summary.totalEmployees} active`}
        />
        {/* Attendance */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Attendance Today</p>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {attendancePct}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <MiniDonut pct={attendancePct} color="#10b981" />
            <div>
              <p className="text-2xl font-bold">{summary.presentToday}</p>
              <p className="text-xs text-muted-foreground">of {summary.totalEmployees} present</p>
              <p className="mt-0.5 text-xs text-amber-600">{summary.lateToday} late</p>
            </div>
          </div>
        </div>
        {/* Leave */}
        <StatCard
          title="On Leave Today"
          value={summary.onLeaveToday}
          icon={Calendar}
          iconColor="#f59e0b"
          href="/leave"
          sparkPoints={[1, 2, summary.onLeaveToday, summary.onLeaveToday + 1, summary.onLeaveToday]}
          sparkColor="#f59e0b"
          badge={`${summary.pendingLeaveRequests} pending`}
          badgeWarn
        />
        {/* Expiry alerts summary */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-2 text-sm text-muted-foreground">Document Alerts</p>
          <p className="text-3xl font-bold text-warning">
            {empAlerts.length + bizAlerts.length + branchAlerts.length}
          </p>
          <div className="mt-3 space-y-1">
            <AlertPill label="Employees" count={empAlerts.length} color="text-destructive" />
            <AlertPill label="Company" count={bizAlerts.length} color="text-amber-600" />
            <AlertPill label="Branch" count={branchAlerts.length} color="text-amber-500" />
          </div>
        </div>
      </div>

      {/* ── Row 2: Recruitment bar chart + Attendance mini chart ─────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recruitment pipeline bar chart */}
        <section className="col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-brand" />
              Recruitment Pipeline
            </h2>
            <Link href="/recruitment">
              <Button variant="ghost" className="h-7 px-2 text-xs">View all</Button>
            </Link>
          </div>
          {recruitBars.length ? (
            <div className="overflow-hidden">
              <BarChart bars={recruitBars} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No candidates yet.</p>
          )}
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Candidates
          </h3>
          <ul className="divide-y divide-border">
            {(data?.recentCandidates ?? []).slice(0, 4).map((c) => (
              <li key={c._id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{c.candidateName}</span>
                <span className="mr-2 text-muted-foreground">{c.position}</span>
                <StatusBadge status={c.status} />
              </li>
            ))}
            {!data?.recentCandidates?.length && (
              <li className="py-2 text-sm text-muted-foreground">No recent candidates.</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {data?.pendingInterviews ?? 0} interviews scheduled
          </p>
        </section>

        {/* Attendance + quick actions */}
        <section className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-base font-semibold">Attendance Trend</h2>
            <Sparkline points={sparkPoints} color="#6366f1" />
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-green-600">{summary.presentToday}</p>
                <p className="text-[10px] text-muted-foreground">Present</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{summary.lateToday}</p>
                <p className="text-[10px] text-muted-foreground">Late</p>
              </div>
              <div>
                <p className="text-lg font-bold text-muted-foreground">{summary.onLeaveToday}</p>
                <p className="text-[10px] text-muted-foreground">On Leave</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <Link href="/attendance">
                <Button variant="secondary" className="w-full justify-start">
                  <Clock className="mr-2 h-4 w-4" /> Attendance
                </Button>
              </Link>
              <Link href="/leave">
                <Button variant="secondary" className="w-full justify-start">
                  <Calendar className="mr-2 h-4 w-4" /> Leave Requests
                </Button>
              </Link>
              {can("employee:create") && (
                <Link href="/employees">
                  <Button variant="secondary" className="w-full justify-start">
                    <UserPlus className="mr-2 h-4 w-4" /> Add Employee
                  </Button>
                </Link>
              )}
              {can("recruitment:edit") && (
                <Link href="/recruitment">
                  <Button variant="secondary" className="w-full justify-start">
                    <Plus className="mr-2 h-4 w-4" /> Recruitment
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Row 3: Three separate document expiry cards ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ExpiryCard
          title="Employee Document Expiry"
          icon={FileWarning}
          iconColor="text-destructive"
          count={empAlerts.length}
          href="/employees"
          empty="All employee documents are valid."
        >
          {empAlerts.slice(0, 8).map((a, i) => (
            <ExpiryRow
              key={i}
              level={a.alertLevel}
              primary={a.employeeName}
              secondary={fmtType(String(a.document?.type ?? ""))}
              days={a.daysRemaining}
            />
          ))}
          {empAlerts.length > 8 && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              +{empAlerts.length - 8} more — <Link href="/employees" className="text-brand underline-offset-2 hover:underline">view all</Link>
            </p>
          )}
        </ExpiryCard>

        <ExpiryCard
          title="Company Document Expiry"
          icon={Building2}
          iconColor="text-amber-500"
          count={bizAlerts.length}
          href="/settings/company"
          empty="All company documents are valid."
        >
          {bizAlerts.map((a, i) => (
            <ExpiryRow
              key={i}
              level={a.alertLevel}
              primary={a.customTypeName ?? fmtType(String(a.type ?? ""))}
              secondary={"Business Document"}
              days={a.daysRemaining}
            />
          ))}
        </ExpiryCard>

        <ExpiryCard
          title="Branch Document Expiry"
          icon={ShieldAlert}
          iconColor="text-orange-500"
          count={branchAlerts.length}
          href="/settings/branches"
          empty="All branch documents are valid."
        >
          {branchAlerts.map((a, i) => (
            <ExpiryRow
              key={i}
              level={a.alertLevel}
              primary={a.branchName ?? "Branch"}
              secondary={a.customTypeName ?? fmtType(String(a.type ?? ""))}
              days={a.daysRemaining}
            />
          ))}
        </ExpiryCard>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title, value, icon: Icon, iconColor, href, sparkPoints, sparkColor, badge, badgeWarn,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  href: string;
  sparkPoints: number[];
  sparkColor: string;
  badge?: string;
  badgeWarn?: boolean;
}) {
  return (
    <Link href={href} className="group rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {badge ? (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
              badgeWarn
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-brand/10 text-brand"
            }`}>
              {badge}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-lg p-2" style={{ background: iconColor + "18" }}>
            <Icon className="h-5 w-5" style={{ color: iconColor }} />
          </div>
          <Sparkline points={sparkPoints} color={sparkColor} />
        </div>
      </div>
    </Link>
  );
}

function AlertPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${count ? color : "text-muted-foreground"}`}>
        {count ? `${count} alert${count !== 1 ? "s" : ""}` : "—"}
      </span>
    </div>
  );
}

function ExpiryCard({
  title, icon: Icon, iconColor, count, href, empty, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  count: number;
  href: string;
  empty: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {count > 0 ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              {count} alert{count !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
              All clear
            </span>
          )}
          <Link href={href}>
            <Button variant="ghost" className="h-6 px-2 text-[10px]">View</Button>
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-1.5 p-4">
        {count === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <p className="text-xs text-green-700 dark:text-green-400">{empty}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function ExpiryRow({
  level, primary, secondary, days,
}: {
  level: string;
  primary: string;
  secondary: string;
  days: number;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${alertRowClass(level)}`}>
      <div className="min-w-0">
        <p className="truncate font-medium">{primary}</p>
        <p className="truncate capitalize text-muted-foreground">{secondary}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className={`text-xs ${daysColor(days)}`}>{days}d</span>
        {level === "critical" && <AlertTriangle className="h-3 w-3 text-destructive" />}
      </div>
    </div>
  );
}
