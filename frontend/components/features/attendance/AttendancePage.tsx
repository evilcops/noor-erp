"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmployees } from "@/hooks/useEmployees";
import { attendanceApi, type AttendanceRecord } from "@/lib/api/attendance";
import { formatDate } from "@/lib/date";

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "on_leave", label: "On Leave" },
  { value: "holiday", label: "Holiday" },
  { value: "correction_pending", label: "Correction Pending" },
  { value: "approved_correction", label: "Approved Correction" },
];

const RECORD_STATUS_OPTIONS = STATUS_OPTIONS.filter((s) => s.value);

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function toDatetimeLocal(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = {
  employeeId: "",
  date: new Date().toISOString().slice(0, 10),
  timeIn: "",
  timeOut: "",
  status: "present",
  notes: "",
};

export function AttendancePage() {
  const { activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const range = monthRange();

  const [fromDate, setFromDate] = useState(range.from);
  const [toDate, setToDate] = useState(range.to);
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [checkModal, setCheckModal] = useState<"in" | "out" | null>(null);

  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [checkEmployeeId, setCheckEmployeeId] = useState("");
  const [correction, setCorrection] = useState({ timeIn: "", timeOut: "", reason: "" });

  const { data: employeesData } = useEmployees({ limit: 200, status: "active", branchId: activeBranchId ?? undefined });
  const employeeOptions = useMemo(
    () =>
      (employeesData?.data ?? []).map((e) => ({
        value: e._id,
        label: `${e.firstName} ${e.lastName} (${e.employeeId})`,
      })),
    [employeesData]
  );

  const listParams = {
    fromDate,
    toDate,
    branchId: activeBranchId ?? undefined,
    employeeId: employeeFilter || undefined,
    status: statusFilter || undefined,
    limit: 100,
  };

  const { data: records, isLoading } = useQuery({
    queryKey: ["attendance-list", listParams],
    queryFn: () => attendanceApi.list(listParams),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        employeeId: form.employeeId,
        date: form.date,
        timeIn: form.timeIn ? new Date(form.timeIn).toISOString() : undefined,
        timeOut: form.timeOut ? new Date(form.timeOut).toISOString() : undefined,
        status: form.status,
        notes: form.notes || undefined,
      };
      return selected
        ? attendanceApi.update(selected._id, payload)
        : attendanceApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-list"] });
      toast.success(selected ? "Attendance updated" : "Attendance created");
      setFormOpen(false);
      setSelected(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => attendanceApi.delete(selected!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-list"] });
      toast.success("Attendance deleted");
      setDeleteOpen(false);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkMut = useMutation({
    mutationFn: (type: "in" | "out") => {
      const payload = {
        employeeId: checkEmployeeId,
        lat: location?.lat ?? 0,
        lng: location?.lng ?? 0,
        address: location?.address,
      };
      return type === "in" ? attendanceApi.checkIn(payload) : attendanceApi.checkOut(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-list"] });
      toast.success("Attendance recorded");
      setCheckModal(null);
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
      qc.invalidateQueries({ queryKey: ["attendance-list"] });
      toast.success("Correction requested");
      setCorrectionOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocation({ lat: 0, lng: 0, address: "GPS unavailable — manual entry" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: "Captured location" }),
      () => setLocation({ lat: 0, lng: 0, address: "Location capture failed" })
    );
  }

  function openCreate() {
    setSelected(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(record: AttendanceRecord) {
    setSelected(record);
    const empId = typeof record.employeeId === "object" ? record.employeeId._id : String(record.employeeId);
    setForm({
      employeeId: empId,
      date: new Date(record.date).toISOString().slice(0, 10),
      timeIn: toDatetimeLocal(record.timeIn),
      timeOut: toDatetimeLocal(record.timeOut),
      status: record.status,
      notes: record.notes ?? "",
    });
    setFormOpen(true);
  }

  function handleExport() {
    const rows = records?.data ?? [];
    const csv = [
      ["Date", "Employee", "Check In", "Check Out", "Hours", "Late (min)", "Early Leave (min)", "Status", "Notes"].join(","),
      ...rows.map((r) => {
        const name = typeof r.employeeId === "object" ? `${r.employeeId.firstName} ${r.employeeId.lastName}` : "";
        return [
          formatDate(r.date),
          `"${name}"`,
          r.timeIn ? new Date(r.timeIn).toLocaleTimeString() : "",
          r.timeOut ? new Date(r.timeOut).toLocaleTimeString() : "",
          r.totalHours?.toFixed(1) ?? "",
          r.lateMinutes ?? 0,
          r.earlyLeaveMinutes ?? 0,
          r.status,
          `"${(r.notes ?? "").replace(/"/g, '""')}"`,
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${fromDate}-to-${toDate}.csv`;
    a.click();
    toast.success("Export downloaded");
  }

  const columns: Column<AttendanceRecord>[] = [
    { key: "date", header: "Date", cell: (r) => formatDate(r.date) },
    {
      key: "employee",
      header: "Employee",
      cell: (r) =>
        typeof r.employeeId === "object"
          ? `${r.employeeId.firstName} ${r.employeeId.lastName}`
          : "—",
    },
    { key: "in", header: "Check In", cell: (r) => (r.timeIn ? new Date(r.timeIn).toLocaleTimeString() : "—") },
    { key: "out", header: "Check Out", cell: (r) => (r.timeOut ? new Date(r.timeOut).toLocaleTimeString() : "—") },
    { key: "hours", header: "Hours", cell: (r) => r.totalHours?.toFixed(1) ?? "—" },
    {
      key: "flags",
      header: "Flags",
      cell: (r) => (
        <div className="flex flex-wrap gap-1 text-xs">
          {r.isLate ? <span className="text-amber-600">Late {r.lateMinutes}m</span> : null}
          {r.isEarlyLeave ? <span className="text-orange-600">Early {r.earlyLeaveMinutes}m</span> : null}
          {r.isMissedCheckout ? <span className="text-red-600">Missed checkout</span> : null}
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex gap-1">
          {r.status === "correction_pending" && can("attendance:approve") ? (
            <>
              <Button
                variant="ghost"
                onClick={async () => {
                  await attendanceApi.approveCorrection(r._id, true);
                  qc.invalidateQueries({ queryKey: ["attendance-list"] });
                  toast.success("Correction approved");
                }}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await attendanceApi.approveCorrection(r._id, false, "Rejected by manager");
                  qc.invalidateQueries({ queryKey: ["attendance-list"] });
                  toast.success("Correction rejected");
                }}
              >
                Reject
              </Button>
            </>
          ) : null}
          {can("attendance:edit") ? (
            <Button variant="ghost" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {can("attendance:create") && !r.timeOut ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(r);
                setCorrection({ timeIn: "", timeOut: "", reason: "Missed checkout" });
                setCorrectionOpen(true);
              }}
            >
              Fix
            </Button>
          ) : null}
          {can("attendance:delete") ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(r);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Manage employee attendance — record check-ins, edit records, and approve corrections."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Attendance" }]}
        actions={
          <div className="flex gap-2">
            {can("attendance:export") || can("attendance:view") ? (
              <Button variant="secondary" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            ) : null}
            {can("attendance:create") ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <DateRangePicker fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />

        <div className="flex flex-col">
          <label htmlFor="employeeFilter">Employee</label>
          <Select
            id="employeeFilter"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            options={[{ value: "", label: "All Employees" }, ...employeeOptions]}
            className="w-56"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="statusFilter">Status</label>
          <Select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_OPTIONS}
            className="w-44"
          />
        </div>
      </div>

      <DataTable columns={columns} data={records?.data ?? []} loading={isLoading} emptyTitle="No attendance records" />

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selected ? "Edit Attendance" : "Add Attendance"}
        footer={
          <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()} disabled={!form.employeeId || !form.date}>
            {selected ? "Save Changes" : "Create Record"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Employee *</Label>
            <Select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              options={[{ value: "", label: "Select employee..." }, ...employeeOptions]}
              disabled={!!selected}
            />
          </div>
          <div>
            <Label>Date *</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Check In</Label>
              <Input type="datetime-local" value={form.timeIn} onChange={(e) => setForm({ ...form, timeIn: e.target.value })} />
            </div>
            <div>
              <Label>Check Out</Label>
              <Input type="datetime-local" value={form.timeOut} onChange={(e) => setForm({ ...form, timeOut: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={RECORD_STATUS_OPTIONS}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        title="Request Correction"
        footer={<Button loading={correctionMut.isPending} onClick={() => correctionMut.mutate()}>Submit</Button>}
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

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Attendance"
        description="This will permanently remove the attendance record. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteMut.mutate()}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
