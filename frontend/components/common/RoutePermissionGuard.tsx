"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getRoutePermission } from "@/config/site";
import { useAuth } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";

export function RoutePermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useAuth();
  const { can } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const required = getRoutePermission(pathname);
  if (required && !can(required)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ShieldX className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          You don&apos;t have permission to access this page. Contact your administrator if you
          believe this is a mistake.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
