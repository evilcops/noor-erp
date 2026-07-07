import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  suspended: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  resigned: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  present: "bg-emerald-100 text-emerald-800",
  late: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-800",
  half_day: "bg-blue-100 text-blue-800",
  new: "bg-blue-100 text-blue-800",
  shortlisted: "bg-indigo-100 text-indigo-800",
  interview_scheduled: "bg-purple-100 text-purple-800",
  interviewed: "bg-violet-100 text-violet-800",
  offered: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  hired: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-700",
  pending_manager: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  pending_assignment: "bg-amber-100 text-amber-800",
  scheduled: "bg-blue-100 text-blue-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  refused: "bg-orange-100 text-orange-800",
  rescheduled: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-100 text-gray-600",
  on_delivery: "bg-indigo-100 text-indigo-800",
  available: "bg-emerald-100 text-emerald-800",
  loading: "bg-amber-100 text-amber-800",
  returning_to_warehouse: "bg-blue-100 text-blue-800",
  break: "bg-slate-100 text-slate-700",
  offline: "bg-gray-100 text-gray-600",
  order_confirmed: "bg-slate-100 text-slate-700",
  picking: "bg-amber-100 text-amber-800",
  packing: "bg-yellow-100 text-yellow-800",
  ready_for_dispatch: "bg-emerald-100 text-emerald-800",
  waiting_for_rider: "bg-blue-100 text-blue-800",
  loaded: "bg-indigo-100 text-indigo-800",
  dispatched: "bg-purple-100 text-purple-800",
  off_duty: "bg-slate-100 text-slate-700",
  inactive: "bg-gray-100 text-gray-600",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}
