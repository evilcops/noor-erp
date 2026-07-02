"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Eye, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { FileUpload } from "@/components/common/FileUpload";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { LeaveAttachmentViewer } from "@/components/features/leave/LeaveAttachmentViewer";
import { useAuth } from "@/hooks";
import { employeeApi } from "@/lib/api/employees";
import { leaveApi, type LeaveRequest } from "@/lib/api/leave";
import { formatDateRange } from "@/lib/date";
import {
  isLeaveTypeAllowedForGender,
  leaveBalanceTypesForGender,
  leaveTypeRequiresDocument,
  type LeaveBalanceType,
} from "@/lib/leave/constants";

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
  type: "annual",
  startDate: "",
  endDate: "",
  reason: "",
};

const DOCUMENT_HINTS: Record<string, string> = {
  sick: "Upload a medical certificate or doctor's note",
  emergency: "Upload proof supporting your emergency leave request",
  maternity: "Upload medical certificate or hospital confirmation of pregnancy/maternity",
  paternity: "Upload birth certificate or hospital discharge summary",
};

export function MyLeavePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const linked = !!user?.employeeId;

  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState("");

  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee", user?.employeeId],
    queryFn: () => employeeApi.getById(user!.employeeId!),
    enabled: linked,
  });

  const employeeGender = myEmployee?.gender;
  const availableLeaveTypes = useMemo(
    () => LEAVE_TYPES.filter((t) => isLeaveTypeAllowedForGender(t.value, employeeGender)),
    [employeeGender]
  );
  const visibleBalanceTypes = useMemo(
    () => leaveBalanceTypesForGender(employeeGender),
    [employeeGender]
  );

  const requiresDocument = leaveTypeRequiresDocument(form.type);

  useEffect(() => {
    if (!isLeaveTypeAllowedForGender(form.type, employeeGender)) {
      setForm((prev) => ({
        ...prev,
        type: availableLeaveTypes[0]?.value ?? "annual",
      }));
    }
  }, [employeeGender, availableLeaveTypes, form.type]);

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["my-leave-balance"],
    queryFn: () => leaveApi.getBalance({}),
    enabled: linked,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const { data: leaves, isLoading } = useQuery({
    queryKey: ["my-leaves", statusFilter],
    queryFn: () =>
      leaveApi.list({
        status: statusFilter || undefined,
        limit: 100,
      }),
    enabled: linked,
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (requiresDocument && !attachmentFile) {
        throw new Error("Supporting document is required for this leave type");
      }

      let attachmentUrl: string | undefined;
      if (attachmentFile) {
        const fd = new FormData();
        fd.append("file", attachmentFile);
        const uploaded = await leaveApi.uploadAttachment(fd);
        attachmentUrl = uploaded.attachmentUrl;
      }

      return leaveApi.request({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
        attachmentUrl,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balance"] });
      toast.success("Leave request submitted — pending approval");
      setFormOpen(false);
      setForm(emptyForm);
      setAttachmentFile(null);
      setAttachmentError("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => leaveApi.cancel(selected!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balance"] });
      toast.success("Leave request cancelled");
      setCancelOpen(false);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<LeaveRequest>[] = useMemo(
    () => [
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
                setSelected(r);
                setViewerOpen(true);
              }}
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              View
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "reason",
        header: "Reason",
        cell: (r) => <span className="text-muted-foreground">{r.reason || "—"}</span>,
      },
      {
        key: "actions",
        header: "",
        cell: (r) =>
          r.status === "pending" ? (
            <Button
              variant="ghost"
              className="h-8 text-xs text-destructive"
              onClick={() => {
                setSelected(r);
                setCancelOpen(true);
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          ) : null,
      },
    ],
    []
  );

  function handleOpenForm(open: boolean) {
    setFormOpen(open);
    if (!open) {
      setForm(emptyForm);
      setAttachmentFile(null);
      setAttachmentError("");
    }
  }

  function handleSubmit() {
    if (requiresDocument && !attachmentFile) {
      setAttachmentError("Supporting document is required");
      return;
    }
    setAttachmentError("");
    submitMut.mutate();
  }

  if (!linked) {
    return (
      <div>
        <PageHeader
          title="My Leave"
          description="Apply for leave and track your requests."
          breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "My Leave" }]}
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
        title="My Leave"
        description="Apply for leave and track your requests."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "My Leave" }]}
        actions={
          <Button onClick={() => handleOpenForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Apply for Leave
          </Button>
        }
      />

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand" />
          <h2 className="font-semibold text-foreground">Leave Balance</h2>
        </div>
        {balanceLoading ? (
          <p className="text-sm text-muted-foreground">Loading balance...</p>
        ) : balance ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {visibleBalanceTypes.map((type: LeaveBalanceType) => (
              <div key={type} className="rounded-lg bg-muted/40 px-4 py-3">
                <p className="text-xs font-medium capitalize text-muted-foreground">{type} leave</p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Taken:</span>{" "}
                    <span className="font-semibold">{balance[type].used}</span>
                    <span className="text-muted-foreground"> days</span>
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Remaining:</span>{" "}
                    <span className="font-semibold text-brand">{balance[type].remaining}</span>
                    <span className="text-muted-foreground"> days</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {balance[type].total} days allocated
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No balance data available.</p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_FILTER}
          className="w-44"
        />
      </div>

      <DataTable
        columns={columns}
        data={leaves?.data ?? []}
        loading={isLoading}
        emptyTitle="No leave requests"
        emptyDescription="Click Apply for Leave to submit your first request."
      />

      <Modal
        open={formOpen}
        onOpenChange={handleOpenForm}
        title="Apply for Leave"
        footer={
          <Button
            loading={submitMut.isPending}
            onClick={handleSubmit}
            disabled={!form.startDate || !form.endDate}
          >
            Submit Request
          </Button>
        }
      >
        <div className="space-y-4">
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
          {requiresDocument ? (
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
          <div>
            <Label>Reason</Label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              placeholder="Optional — explain the reason for your leave"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>

      <LeaveAttachmentViewer
        attachmentUrl={selected?.attachmentUrl}
        title={`${selected?.type ?? "Leave"} supporting document`}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      <ConfirmationModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Leave Request"
        description="Are you sure you want to cancel this pending leave request?"
        confirmLabel="Cancel Request"
        variant="danger"
        onConfirm={() => cancelMut.mutate()}
        loading={cancelMut.isPending}
      />
    </div>
  );
}
