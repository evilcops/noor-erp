"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { attendanceApi, type AttendanceRecord } from "@/lib/api/attendance";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export function AttendancePage() {
  const { branches, activeBranchId } = useBranch();
  const { can, isManager } = usePermissions();
  const qc = useQueryClient();
  const range = monthRange();

  const [fromDate, setFromDate] = useState(range.from);
  const [toDate, setToDate] = useState(range.to);
  const [statusFilter, setStatusFilter] = useState("");
  const [checkModal, setCheckModal] = useState<"in" | "out" | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [correction, setCorrection] = useState({ timeIn: "", timeOut: "", reason: "" });

  const { data: today } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: () => attendanceApi.getToday(),
    refetchInterval: 60_000,
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ["attendance-report", fromDate, toDate, statusFilter, activeBranchId],
    queryFn: () => attendanceApi.getReport({ fromDate, toDate, branchId: activeBranchId ?? undefined, status: statusFilter || undefined }),
    enabled: isManager,
  });

  const { data: myRecords, isLoading: myLoading } = useQuery({
    queryKey: ["attendance-my", fromDate, toDate],
    queryFn: () => attendanceApi.getMy({ fromDate, toDate }),
    enabled: !isManager,
  });

  const checkMut = useMutation({
    mutationFn: (type: "in" | "out") => {
      const payload = { lat: location?.lat ?? 0, lng: location?.lng ?? 0, address: location?.address, notes };
      return type === "in" ? attendanceApi.checkIn(payload) : attendanceApi.checkOut(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      toast.success("Attendance recorded");
      setCheckModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const correctionMut = useMutation({
    mutationFn: () => attendanceApi.requestCorrection({
      attendanceId: selected!._id,
      requestedTimeIn: correction.timeIn || undefined,
      requestedTimeOut: correction.timeOut || undefined,
      reason: correction.reason,
    }),
    onSuccess: () => { toast.success("Correction requested"); setCorrectionOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error("GPS not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: "Captured location" }),
      () => toast.error("Could not capture location")
    );
  }

  const list = isManager ? (records ?? []) : (myRecords?.data ?? []);
  const loading = isManager ? isLoading : myLoading;

  const myToday = today?.find((a) => a.timeIn && !a.timeOut);

  const columns: Column<AttendanceRecord>[] = [
    { key: "date", header: "Date", cell: (r) => new Date(r.date).toLocaleDateString() },
    {
      key: "employee",
      header: "Employee",
      cell: (r) => typeof r.employeeId === "object"
        ? `${r.employeeId.firstName} ${r.employeeId.lastName}`
        : "—",
    },
    { key: "in", header: "Check In", cell: (r) => r.timeIn ? new Date(r.timeIn).toLocaleTimeString() : "—" },
    { key: "out", header: "Check Out", cell: (r) => r.timeOut ? new Date(r.timeOut).toLocaleTimeString() : "—" },
    { key: "hours", header: "Hours", cell: (r) => r.totalHours?.toFixed(1) ?? "—" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => r.status === "correction_pending" && can("attendance:approve") ? (
        <Button variant="ghost" onClick={async () => {
          await attendanceApi.approveCorrection(r._id, true);
          toast.success("Approved");
          qc.invalidateQueries({ queryKey: ["attendance-report"] });
        }}>Approve</Button>
      ) : can("attendance:create") ? (
        <Button variant="ghost" onClick={() => { setSelected(r); setCorrectionOpen(true); }}>Request Fix</Button>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Track check-ins, view records, and manage corrections."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Attendance" }]}
      />

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-2xl font-semibold">{new Date().toLocaleDateString("en-OM", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            {myToday ? <StatusBadge status="present" /> : <StatusBadge status="absent" />}
          </div>
          {can("attendance:create") ? (
            <div className="flex gap-2">
              <Button onClick={() => { setCheckModal("in"); captureLocation(); }} disabled={!!myToday}>
                <Clock className="mr-2 h-4 w-4" />Check In
              </Button>
              <Button variant="secondary" onClick={() => { setCheckModal("out"); captureLocation(); }} disabled={!myToday}>
                Check Out
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />

        <div className="flex flex-col">
          <label
            htmlFor="statusFilter"
          >
            Status
          </label>

          <Select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Status" },
              { value: "present", label: "Present" },
              { value: "late", label: "Late" },
              { value: "absent", label: "Absent" },
              { value: "half_day", label: "Half Day" },
            ]}
            className="w-36"
          />
        </div>
      </div>

      <DataTable columns={columns} data={list} loading={loading} emptyTitle="No attendance records" />

      <Modal open={!!checkModal} onOpenChange={() => setCheckModal(null)} title={checkModal === "in" ? "Check In" : "Check Out"} footer={
        <Button loading={checkMut.isPending} onClick={() => checkMut.mutate(checkModal!)}>Confirm</Button>
      }>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-brand" />
            {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} — ${location.address}` : "Capturing GPS..."}
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
      </Modal>

      <Modal open={correctionOpen} onOpenChange={setCorrectionOpen} title="Request Correction" footer={
        <Button loading={correctionMut.isPending} onClick={() => correctionMut.mutate()}>Submit</Button>
      }>
        <div className="space-y-3">
          <div><Label>Requested Check In</Label><Input type="datetime-local" value={correction.timeIn} onChange={(e) => setCorrection({ ...correction, timeIn: e.target.value })} /></div>
          <div><Label>Requested Check Out</Label><Input type="datetime-local" value={correction.timeOut} onChange={(e) => setCorrection({ ...correction, timeOut: e.target.value })} /></div>
          <div><Label>Reason *</Label><textarea value={correction.reason} onChange={(e) => setCorrection({ ...correction, reason: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></div>
        </div>
      </Modal>
    </div>
  );
}
