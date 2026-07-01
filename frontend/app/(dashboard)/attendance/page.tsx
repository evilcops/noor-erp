"use client";

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { AttendancePage } from "@/components/features/attendance/AttendancePage";
import { MyAttendancePage } from "@/components/features/attendance/MyAttendancePage";
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
    return <MyAttendancePage />;
  }

  return <AttendancePage />;
}
