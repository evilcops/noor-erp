"use client";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { LeavePage } from "@/components/features/leave/LeavePage";
import { MyLeavePage } from "@/components/features/leave/MyLeavePage";
import { useAuth } from "@/hooks";
import { isEmployeeRole } from "@/lib/permissions";

export default function Page() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isEmployeeRole(user)) {
    return <MyLeavePage />;
  }

  return <LeavePage />;
}
