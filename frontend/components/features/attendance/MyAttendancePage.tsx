"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/hooks";
import { attendanceApi, type AttendanceRecord } from "@/lib/api/attendance";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function MyAttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const range = monthRange();

  const [fromDate, setFromDate] = useState(range.from);
  const [toDate, setToDate] = useState(range.to);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [correction, setCorrection] = useState({ timeIn: "", timeOut: "", reason: "" });
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  const linked = !!user?.employeeId;

  const { data: todayData } = useQuery({
    queryKey: ["my-attendance-today"],
    queryFn: () => attendanceApi.getMy({ fromDate: todayStr(), toDate: todayStr(), limit: 1 }),
    enabled: linked,
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ["my-attendance", fromDate, toDate],
    queryFn: () => attendanceApi.getMy({ fromDate, toDate, limit: 100 }),
    enabled: linked,
  });

  const todayRecord = todayData?.data?.[0];
  const checkedIn = !!todayRecord?.timeIn;
  const checkedOut = !!todayRecord?.timeOut;

  const checkMut = useMutation({
    mutationFn: (type: "in" | "out") => {
      const payload = {
        lat: location?.lat ?? 0,
        lng: location?.lng ?? 0,
        address: location?.address,
      };
      return type === "in" ? attendanceApi.checkIn(payload) : attendanceApi.checkOut(payload);
    },
    onSuccess: (_, type) => {
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      qc.invalidateQueries({ queryKey: ["my-attendance-today"] });
      toast.success(type === "in" ? "Checked in successfully" : "Checked out successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const correctionMut = useMutation({
    mutationFn: () =>
      attendanceApi.requestCorrection({
        attendanceId: selected!._id,
        requestedTimeIn: correction.timeIn || undefined,
        requestedTimeOut: correction.timeOut || undefined,
        reason: correction.reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      toast.success("Correction request submitted");
      setCorrectionOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocation({ lat: 0, lng: 0, address: "GPS unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "Location captured",
        }),
      () => setLocation({ lat: 0, lng: 0, address: "Location capture failed" })
    );
  }

  function handleCheck(type: "in" | "out") {
    captureLocation();
    checkMut.mutate(type);
  }

  const columns: Column<AttendanceRecord>[] = useMemo(
    () => [
      { key: "date", header: "Date", cell: (r) => new Date(r.date).toLocaleDateString() },
      {
        key: "in",
        header: "Check In",
        cell: (r) => (r.timeIn ? new Date(r.timeIn).toLocaleTimeString() : "—"),
      },
      {
        key: "out",
        header: "Check Out",
        cell: (r) => (r.timeOut ? new Date(r.timeOut).toLocaleTimeString() : "—"),
      },
      { key: "hours", header: "Hours", cell: (r) => r.totalHours?.toFixed(1) ?? "—" },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      {
        key: "actions",
        header: "",
        cell: (r) =>
          r.status !== "correction_pending" && !r.timeOut ? (
            <Button
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setSelected(r);
                setCorrection({ timeIn: "", timeOut: "", reason: "" });
                setCorrectionOpen(true);
              }}
            >
              Request fix
            </Button>
          ) : null,
      },
    ],
    []
  );

  if (!linked) {
    return (
      <div>
        <PageHeader
          title="My Attendance"
          description="Mark your daily attendance and view your history."
          breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "My Attendance" }]}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">Account not linked</p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            Your user account is not linked to an employee profile. Please contact HR to set up
            your employee record and login access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Attendance"
        description="Mark your daily attendance and view your history."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "My Attendance" }]}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today — {new Date().toLocaleDateString()}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {checkedOut
                  ? "Day complete"
                  : checkedIn
                    ? "Currently checked in"
                    : "Not checked in yet"}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>
                  In: {todayRecord?.timeIn ? new Date(todayRecord.timeIn).toLocaleTimeString() : "—"}
                </span>
                <span>
                  Out: {todayRecord?.timeOut ? new Date(todayRecord.timeOut).toLocaleTimeString() : "—"}
                </span>
                {todayRecord?.totalHours != null ? (
                  <span>{todayRecord.totalHours.toFixed(1)} hrs</span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleCheck("in")}
                loading={checkMut.isPending}
                disabled={checkedIn}
                className="min-w-[120px]"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Check In
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleCheck("out")}
                loading={checkMut.isPending}
                disabled={!checkedIn || checkedOut}
                className="min-w-[120px]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Check Out
              </Button>
            </div>
          </div>
          {location ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {location.address}
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              Location is captured when you check in or out
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-foreground">This month</p>
          <p className="mt-2 text-3xl font-bold">{records?.data?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">attendance records</p>
        </div>
      </div>

      <div className="mb-4">
        <DateRangePicker fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
      </div>

      <DataTable
        columns={columns}
        data={records?.data ?? []}
        loading={isLoading}
        emptyTitle="No attendance records"
        emptyDescription="Your attendance history will appear here after you check in."
      />

      <Modal
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        title="Request Correction"
        footer={
          <Button
            loading={correctionMut.isPending}
            onClick={() => correctionMut.mutate()}
            disabled={!correction.reason.trim()}
          >
            Submit Request
          </Button>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>Requested Check In</Label>
            <Input
              type="datetime-local"
              value={correction.timeIn}
              onChange={(e) => setCorrection({ ...correction, timeIn: e.target.value })}
            />
          </div>
          <div>
            <Label>Requested Check Out</Label>
            <Input
              type="datetime-local"
              value={correction.timeOut}
              onChange={(e) => setCorrection({ ...correction, timeOut: e.target.value })}
            />
          </div>
          <div>
            <Label>Reason *</Label>
            <textarea
              value={correction.reason}
              onChange={(e) => setCorrection({ ...correction, reason: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
