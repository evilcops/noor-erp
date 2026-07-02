"use client";

import { CalendarClock, Mail, Star, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date";
import type { Candidate, CandidateStatus } from "@/types/recruitment";

const STAGES: {
  status: CandidateStatus;
  label: string;
  hint: string;
  dot: string;
  column: string;
}[] = [
  {
    status: "new",
    label: "New",
    hint: "Fresh applications",
    dot: "bg-sky-500",
    column: "border-sky-200/80 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20",
  },
  {
    status: "shortlisted",
    label: "Shortlisted",
    hint: "Ready for interview",
    dot: "bg-indigo-500",
    column: "border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20",
  },
  {
    status: "interview_scheduled",
    label: "Interview",
    hint: "Scheduled meetings",
    dot: "bg-violet-500",
    column: "border-violet-200/80 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20",
  },
  {
    status: "interviewed",
    label: "Reviewed",
    hint: "Feedback recorded",
    dot: "bg-purple-500",
    column: "border-purple-200/80 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20",
  },
  {
    status: "offered",
    label: "Offered",
    hint: "Offer sent",
    dot: "bg-amber-500",
    column: "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20",
  },
  {
    status: "accepted",
    label: "Accepted",
    hint: "Offer accepted",
    dot: "bg-teal-500",
    column: "border-teal-200/80 bg-teal-50/50 dark:border-teal-900/40 dark:bg-teal-950/20",
  },
  {
    status: "hired",
    label: "Hired",
    hint: "Onboarded",
    dot: "bg-emerald-500",
    column: "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20",
  },
  {
    status: "rejected",
    label: "Rejected",
    hint: "Not selected",
    dot: "bg-rose-500",
    column: "border-rose-200/80 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20",
  },
  {
    status: "archived",
    label: "Archived",
    hint: "Closed records",
    dot: "bg-slate-400",
    column: "border-slate-200/80 bg-slate-50/50 dark:border-slate-800/40 dark:bg-slate-950/20",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatInterviewDate(value?: string) {
  if (!value) return "";
  return formatDate(value);
}

function CandidateCard({
  candidate,
  onClick,
}: {
  candidate: Candidate;
  onClick: () => void;
}) {
  const hasInterview = !!candidate.interviewSchedule?.date;
  const isOnline = candidate.interviewSchedule?.mode === "online";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-xl border border-border/80 bg-card p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
          {initials(candidate.candidateName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm text-foreground group-hover:text-brand">
            {candidate.candidateName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{candidate.position}</p>
          {candidate.department ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
              {candidate.department}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {hasInterview ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {isOnline ? <Video className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
            {formatInterviewDate(candidate.interviewSchedule?.date)}
            {candidate.interviewSchedule?.time
              ? ` · ${candidate.interviewSchedule.time}`
              : ""}
          </span>
        ) : null}
        {candidate.interviewSchedule?.rating ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Star className="h-3 w-3 fill-current" />
            {candidate.interviewSchedule.rating}/5
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        <Mail className="h-3 w-3 shrink-0" />
        {candidate.candidateEmail}
      </p>
    </button>
  );
}

interface RecruitmentPipelineProps {
  candidates: Candidate[];
  loading?: boolean;
  onSelect: (candidate: Candidate) => void;
  statusFilter?: string;
}

export function RecruitmentPipeline({
  candidates,
  loading,
  onSelect,
  statusFilter,
}: RecruitmentPipelineProps) {
  const allGrouped = STAGES.map((stage) => ({
    ...stage,
    items: candidates.filter((c) => c.status === stage.status),
  }));

  const grouped = statusFilter
    ? allGrouped.filter((col) => col.status === statusFilter)
    : allGrouped;

  const totalActive = candidates.filter(
    (c) => !["hired", "rejected", "archived"].includes(c.status)
  ).length;

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">Hiring pipeline</p>
          <p className="text-xs text-muted-foreground">
            {totalActive} active candidate{totalActive === 1 ? "" : "s"} across{" "}
            {STAGES.length} stages
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {grouped
            .filter((col) => col.items.length > 0)
            .slice(0, 4)
            .map((col) => (
              <span
                key={col.status}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium"
              >
                <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                {col.label}: {col.items.length}
              </span>
            ))}
        </div>
      </div>

      <div className="relative -mx-1 px-1">
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
          {grouped.map((column) => (
            <div
              key={column.status}
              className={cn(
                "flex w-[280px] shrink-0 snap-start flex-col rounded-2xl border shadow-sm",
                column.column
              )}
            >
              <div className="border-b border-border/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", column.dot)} />
                    <h3 className="text-sm font-semibold text-foreground">{column.label}</h3>
                  </div>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-card px-2 text-xs font-semibold text-foreground shadow-sm">
                    {column.items.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{column.hint}</p>
              </div>

              <div className="flex min-h-[320px] flex-1 flex-col gap-2.5 p-3">
                {column.items.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-8 text-center">
                    <p className="text-xs font-medium text-muted-foreground">No candidates</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      Cards appear here when moved to this stage
                    </p>
                  </div>
                ) : (
                  column.items.map((candidate) => (
                    <CandidateCard
                      key={candidate._id}
                      candidate={candidate}
                      onClick={() => onSelect(candidate)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
