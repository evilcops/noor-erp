"use client";

import { Lock } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

interface DashboardSectionGateProps {
  permission?: string;
  /** If set, user needs any one of these permissions (overrides `permission`) */
  anyOf?: string[];
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export function DashboardSectionGate({
  permission,
  anyOf,
  title = "This section",
  className,
  children,
}: DashboardSectionGateProps) {
  const { can } = usePermissions();

  const allowed = anyOf?.length
    ? anyOf.some((p) => can(p))
    : permission
      ? can(permission)
      : true;
  if (!allowed) {
    return (
      <div
        className={cn(
          "flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center",
          className
        )}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Access Restricted</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          You don&apos;t have permission to view {title.toLowerCase()}. Contact your administrator
          to request access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

interface DashboardPageGateProps {
  children: React.ReactNode;
}

export function DashboardPageGate({ children }: DashboardPageGateProps) {
  const { can } = usePermissions();

  if (!can("dashboard:view")) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          You don&apos;t have permission to view the dashboard. Contact your administrator to
          request access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
