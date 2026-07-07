"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { FileUpload } from "@/components/common/FileUpload";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { BranchSubBranchSelect } from "@/components/common/BranchSubBranchSelect";
import { Select } from "@/components/ui/Select";
import { effectiveBranchId } from "@/lib/branch-utils";
import { Tabs } from "@/components/ui/Tabs";
import { LeaveAttachmentViewer } from "@/components/features/leave/LeaveAttachmentViewer";
import { useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmployees } from "@/hooks/useEmployees";
import { leaveApi, type LeaveRequest } from "@/lib/api/leave";
import { formatDate, formatDateRange } from "@/lib/date";
import { isLeaveTypeAllowedForGender, leaveBalanceTypesForGender, leaveTypeRequiresDocument } from "@/lib/leave/constants";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual" },
  { value: "sick", label: "Sick" },
  { value: "emergency", label: "Emergency" },
  { value: "unpaid", label: "Unpaid" },
  { value: "maternity", label: "Maternity" },
  { value: "paternity", label: "Paternity" },
  { value: "other", label: "Other" },
];

const STATUS_FILTER = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const emptyForm = {
  employeeId: "",
  type: "annual",
  startDate: "",
  endDate: "",
  reason: "",
  status: "pending",
};

const DOCUMENT_HINTS: Record<string, string> = {
  sick: "Medical certificate or doctor's note",
  emergency: "Proof supporting the emergency leave",
  maternity: "Medical certificate or hospital confirmation of pregnancy/maternity",
  paternity: "Birth certificate or hospital discharge summary",
};

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export function LeavePage() {
  const { branches, activeMainBranchId, activeSubBranchId, activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const range = monthRange();

  const [tab, setTab] = useState("pending");
  const [fromDate, setFromDate] = useState(range.from);
  const [toDate, setToDate] = useState(range.to);
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [mainBranchFilter, setMainBranchFilter] = useState("");
  const [subBranchFilter, setSubBranchFilter] = useState("");
  const branchFilter = effectiveBranchId(mainBranchFilter, subBranchFilter);
  const [balanceEmployeeId, setBalanceEmployeeId] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [reviewLeave, setReviewLeave] = useState<LeaveRequest | null>(null);

  const formRequiresDocument = !selected && leaveTypeRequiresDocument(form.type);

  const { data: employeesData } = useEmployees({
    limit: 200,
    status: "active",
    branchId: branchFilter || activeBranchId || undefined,
  });

  const formEmployeeGender = useMemo(
    () => employeesData?.data?.find((e) => e._id === form.employeeId)?.gender,
    [employeesData, form.employeeId]
  );

  const availableLeaveTypes = useMemo(
    () => LEAVE_TYPES.filter((t) => isLeaveTypeAllowedForGender(t.value, formEmployeeGender)),
    [formEmployeeGender]
  );

  const employeeOptions = useMemo(
    () =>
      (employeesData?.data ?? []).map((e) => ({
        value: e._id,
        label: `${e.firstName} ${e.lastName} (${e.employeeId})`,
      })),
    [employeesData]
  );

  const listParams = {
    branchId: branchFilter || undefined,
    employeeId: employeeFilter || undefined,
    status: tab === "pending" ? "pending" : statusFilter || undefined,
    fromDate: tab === "pending" ? undefined : fromDate,
    toDate: tab === "pending" ? undefined : toDate,
    limit: 100,
  };

  const { data: leaves, isLoading } = useQuery({
    queryKey: ["leaves-list", listParams],
    queryFn: () => leaveApi.list(listParams),
    enabled: tab !== "calendar",
  });

  const { data: calendar } = useQuery({
    queryKey: ["leave-calendar", activeBranchId, employeeFilter, fromDate, toDate],
    queryFn: () =>
      leaveApi.getCalendar({
        branchId: branchFilter || undefined,
        employeeId: employeeFilter || undefined,
        fromDate,
        toDate,
      }),
    enabled: tab === "calendar",
  });

  const { data: balance } = useQuery({
    queryKey: ["leave-balance", balanceEmployeeId],
    queryFn: () => leaveApi.getBalance({ employeeId: balanceEmployeeId }),
    enabled: !!balanceEmployeeId,
  });

  const balanceEmployeeGender = useMemo(
    () => employeesData?.data?.find((e) => e._id === balanceEmployeeId)?.gender,
    [employeesData, balanceEmployeeId]
  );

  const visibleBalanceTypes = useMemo(
    () => leaveBalanceTypesForGender(balanceEmployeeGender),
    [balanceEmployeeGender]
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      if (formRequiresDocument && !attachmentFile) {
        throw new Error("Supporting document is required for this leave type");
      }

      let attachmentUrl: string | undefined;
      if (attachmentFile) {
        const fd = new FormData();
        fd.append("file", attachmentFile);
        if (form.employeeId) fd.append("employeeId", form.employeeId);
        const uploaded = await leaveApi.uploadAttachment(fd);
        attachmentUrl = uploaded.attachmentUrl;
      }

      const payload = {
        employeeId: form.employeeId,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
        ...(attachmentUrl ? { attachmentUrl } : {}),
        ...(selected ? { status: form.status } : {}),
      };
      return selected ? leaveApi.update(selected._id, payload) : leaveApi.request(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves-list"] });
      qc.invalidateQueries({ queryKey: ["leave-calendar"] });
      if (!selected) {
        setTab("pending");
        setStatusFilter("");
      }
      toast.success(selected ? "Leave updated" : "Leave request submitted — pending approval");
      setFormOpen(false);
      setSelected(null);
      setForm(emptyForm);
      setAttachmentFile(null);
      setAttachmentError("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => leaveApi.delete(selected!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves-list"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balance"] });
      toast.success("Leave cancelled");
      setDeleteOpen(false);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => leaveApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves-list"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balance"] });
      toast.success("Leave approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => leaveApi.reject(selected!._id, rejectReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves-list"] });
      setRejectOpen(false);
      toast.success("Leave rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setSelected(null);
    setForm({ ...emptyForm, employeeId: employeeFilter || "" });
    setAttachmentFile(null);
    setAttachmentError("");
    setFormOpen(true);
  }

  function openEdit(leave: LeaveRequest) {
    setSelected(leave);
    const empId = typeof leave.employeeId === "object" ? leave.employeeId._id : String(leave.employeeId);
    setForm({
      employeeId: empId,
      type: leave.type,
      startDate: new Date(leave.startDate).toISOString().slice(0, 10),
      endDate: new Date(leave.endDate).toISOString().slice(0, 10),
      reason: leave.reason ?? "",
      status: leave.status,
    });
    setFormOpen(true);
  }

  function handleExport() {
    const rows = leaves?.data ?? [];
    const csv = [
      ["Employee", "Type", "Start", "End", "Days", "Status", "Reason"].join(","),
      ...rows.map((r) => {
        const name = typeof r.employeeId === "object" ? `${r.employeeId.firstName} ${r.employeeId.lastName}` : "";
        return [
          `"${name}"`,
          r.type,
          formatDate(r.startDate),
          formatDate(r.endDate),
          r.totalDays,
          r.status,
          `"${(r.reason ?? "").replace(/"/g, '""')}"`,
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-${fromDate}-to-${toDate}.csv`;
    a.click();
    toast.success("Export downloaded");
  }

  const columns: Column<LeaveRequest>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) =>
        typeof r.employeeId === "object" ? `${r.employeeId.firstName} ${r.employeeId.lastName}` : "—",
    },
    { key: "type", header: "Type", cell: (r) => <span className="capitalize">{r.type}</span> },
    {
      key: "dates",
      header: "Dates",
      cell: (r) => formatDateRange(r.startDate, r.endDate),
    },
    { key: "days", header: "Days", cell: (r) => r.totalDays },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "document",
      header: "Document",
      cell: (r) =>
        r.attachmentUrl ? (
          <Button
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => {
              setReviewLeave(r);
              setViewerOpen(true);
            }}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            Review
          </Button>
        ) : leaveTypeRequiresDocument(r.type) ? (
          <span className="text-xs text-amber-600">Missing</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex gap-1">
          {r.status === "pending" && can("leave:approve") ? (
            <>
              {r.attachmentUrl ? (
                <Button
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    setReviewLeave(r);
                    setViewerOpen(true);
                  }}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  Doc
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => approveMut.mutate(r._id)}>
                Approve
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(r);
                  setRejectOpen(true);
                }}
              >
                Reject
              </Button>
            </>
          ) : null}
          {can("leave:edit") ? (
            <Button variant="ghost" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {can("leave:delete") && r.status !== "cancelled" ? (
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
        title="Leave & Holidays"
        description="Manage employee leave requests — create, approve, and track balances."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Leave" }]}
        actions={
          <div className="flex gap-2">
            {can("leave:view") ? (
              <Button variant="secondary" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            ) : null}
            {can("leave:create") ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Leave
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <Label>View balance for</Label>
            <Select
              value={balanceEmployeeId}
              onChange={(e) => setBalanceEmployeeId(e.target.value)}
              options={[{ value: "", label: "Select employee..." }, ...employeeOptions]}
              className="w-56"
            />
          </div>
          {balance ? (
            <div className="flex flex-wrap gap-4">
              {visibleBalanceTypes.map((type) => (
                <div key={type} className="min-w-[140px] rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-xs capitalize text-muted-foreground">{type}</p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Taken:</span> {balance[type].used}
                  </p>
                  <p className="text-sm font-semibold">
                    <span className="font-normal text-muted-foreground">Remaining:</span>{" "}
                    {balance[type].remaining}
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      / {balance[type].total}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "pending", label: "Pending Approval" },
          { id: "all", label: "All Requests" },
          { id: "calendar", label: "Calendar" },
        ]}
        activeTab={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab !== "calendar" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3 items-end">
            {tab === "all" ? (
              <DateRangePicker fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
            ) : null}

            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Branch</span>
              <BranchSubBranchSelect
                branches={branches}
                mainBranchId={mainBranchFilter}
                subBranchId={subBranchFilter}
                onMainBranchChange={(id) => {
                  setMainBranchFilter(id);
                  setSubBranchFilter("");
                }}
                onSubBranchChange={setSubBranchFilter}
                allowAllMain
                allMainLabel="All Branches"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="leaveEmployeeFilter">Employee</label>
              <Select
                id="leaveEmployeeFilter"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                options={[{ value: "", label: "All Employees" }, ...employeeOptions]}
                className="w-56"
              />
            </div>

            {tab === "all" ? (
              <div className="flex flex-col">
                <label htmlFor="leaveStatusFilter">Status</label>
                <Select
                  id="leaveStatusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={STATUS_FILTER}
                  className="w-40"
                />
              </div>
            ) : null}
          </div>

          <DataTable
            columns={columns}
            data={leaves?.data ?? []}
            loading={isLoading}
            emptyTitle={tab === "pending" ? "No pending leave requests" : "No leave requests"}
          />
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(calendar ?? []).map((l) => (
            <div key={l._id} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium">
                {typeof l.employeeId === "object"
                  ? `${l.employeeId.firstName} ${l.employeeId.lastName}`
                  : "Employee"}
              </p>
              <p className="text-sm capitalize text-muted-foreground">
                {l.type} — {l.totalDays} days
              </p>
              <p className="text-xs">
                {formatDateRange(l.startDate, l.endDate)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setAttachmentFile(null);
            setAttachmentError("");
          }
        }}
        title={selected ? "Edit Leave" : "Request Leave"}
        footer={
          <Button
            loading={saveMut.isPending}
            onClick={() => {
              if (formRequiresDocument && !attachmentFile) {
                setAttachmentError("Supporting document is required");
                return;
              }
              setAttachmentError("");
              saveMut.mutate();
            }}
            disabled={!form.employeeId || !form.startDate || !form.endDate}
          >
            {selected ? "Save Changes" : "Submit Request"}
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
            <Label>Leave Type *</Label>
            <Select
              value={form.type}
              onChange={(e) => {
                setForm({ ...form, type: e.target.value });
                setAttachmentFile(null);
                setAttachmentError("");
              }}
              options={availableLeaveTypes}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date *</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          {selected ? (
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={STATUS_FILTER.filter((s) => s.value)}
              />
            </div>
          ) : null}
          {formRequiresDocument ? (
            <div>
              <Label>Supporting Document *</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                {DOCUMENT_HINTS[form.type] ?? "Upload a supporting document"}
              </p>
              <FileUpload
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                label={attachmentFile ? attachmentFile.name : "Upload PDF or image"}
                onFileSelect={(file) => {
                  setAttachmentFile(file);
                  setAttachmentError("");
                }}
                error={attachmentError}
              />
            </div>
          ) : null}
          {selected?.attachmentUrl ? (
            <div>
              <Label>Attached Document</Label>
              <Button
                variant="secondary"
                className="mt-1"
                onClick={() => {
                  setReviewLeave(selected);
                  setViewerOpen(true);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                Review document
              </Button>
            </div>
          ) : null}
          <div>
            <Label>Reason</Label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>

      <LeaveAttachmentViewer
        attachmentUrl={reviewLeave?.attachmentUrl}
        title={
          reviewLeave
            ? `${typeof reviewLeave.employeeId === "object" ? `${reviewLeave.employeeId.firstName} ${reviewLeave.employeeId.lastName}` : "Employee"} — ${reviewLeave.type} leave document`
            : "Leave document"
        }
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      <Modal
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject Leave"
        size="sm"
        footer={
          <Button
            variant="primary"
            className="bg-destructive"
            loading={rejectMut.isPending}
            onClick={() => rejectMut.mutate()}
          >
            Reject
          </Button>
        }
      >
        <div>
          <Label>Rejection Reason *</Label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
      </Modal>

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Cancel Leave"
        description="This will cancel the leave request. Continue?"
        confirmLabel="Cancel Leave"
        onConfirm={() => deleteMut.mutate()}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
