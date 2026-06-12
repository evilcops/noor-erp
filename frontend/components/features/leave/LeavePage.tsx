"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { leaveApi, type LeaveRequest } from "@/lib/api/leave";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual" }, { value: "sick", label: "Sick" },
  { value: "emergency", label: "Emergency" }, { value: "unpaid", label: "Unpaid" },
  { value: "maternity", label: "Maternity" }, { value: "paternity", label: "Paternity" },
  { value: "other", label: "Other" },
];

export function LeavePage() {
  const { can, isManager } = usePermissions();
  const qc = useQueryClient();
  const [tab, setTab] = useState("my");
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({ type: "annual", startDate: "", endDate: "", reason: "" });

  const { data: balance } = useQuery({
    queryKey: ["leave-balance"],
    queryFn: () => leaveApi.getBalance(),
  });

  const { data: myLeaves, isLoading: myLoading } = useQuery({
    queryKey: ["leaves-my"],
    queryFn: () => leaveApi.list({ limit: 50 }),
    enabled: tab === "my",
  });

  const { data: teamLeaves, isLoading: teamLoading } = useQuery({
    queryKey: ["leaves-team"],
    queryFn: () => leaveApi.list({ status: "pending", limit: 50 }),
    enabled: tab === "team" && isManager,
  });

  const { data: calendar } = useQuery({
    queryKey: ["leave-calendar"],
    queryFn: () => leaveApi.getCalendar(),
    enabled: tab === "calendar",
  });

  const requestMut = useMutation({
    mutationFn: () => leaveApi.request(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves-my"] }); toast.success("Leave requested"); setRequestOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => leaveApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves-team"] }); toast.success("Approved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => leaveApi.reject(selected!._id, rejectReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves-team"] }); setRejectOpen(false); toast.success("Rejected"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<LeaveRequest>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => typeof r.employeeId === "object" ? `${r.employeeId.firstName} ${r.employeeId.lastName}` : "—",
    },
    { key: "type", header: "Type", cell: (r) => <span className="capitalize">{r.type}</span> },
    { key: "dates", header: "Dates", cell: (r) => `${new Date(r.startDate).toLocaleDateString()} – ${new Date(r.endDate).toLocaleDateString()}` },
    { key: "days", header: "Days", cell: (r) => r.totalDays },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => r.status === "pending" && can("leave:approve") ? (
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => approveMut.mutate(r._id)}>Approve</Button>
          <Button variant="ghost" onClick={() => { setSelected(r); setRejectOpen(true); }}>Reject</Button>
        </div>
      ) : null,
    },
  ];

  const myColumns = columns.filter((c) => c.key !== "employee" && c.key !== "actions");

  return (
    <div>
      <PageHeader
        title="Leave & Holidays"
        description="Request leave, approve team requests, and view the calendar."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Leave" }]}
        actions={can("leave:create") ? (
          <Button onClick={() => setRequestOpen(true)}><Plus className="mr-2 h-4 w-4" />Request Leave</Button>
        ) : undefined}
      />

      {balance ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["annual", "sick", "emergency", "unpaid"] as const).map((type) => (
            <div key={type} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm capitalize text-muted-foreground">{type} Leave</p>
              <p className="text-2xl font-semibold">{balance[type].remaining}</p>
              <p className="text-xs text-muted-foreground">of {balance[type].total} days</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(balance[type].used / balance[type].total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Tabs
        tabs={[
          { id: "my", label: "My Requests" },
          ...(isManager ? [{ id: "team", label: "Team Requests" }] : []),
          { id: "calendar", label: "Calendar" },
          ...(can("branch:edit") ? [{ id: "holidays", label: "Holidays" }] : []),
        ]}
        activeTab={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "my" ? <DataTable columns={myColumns} data={myLeaves?.data ?? []} loading={myLoading} /> : null}
      {tab === "team" ? <DataTable columns={columns} data={teamLeaves?.data ?? []} loading={teamLoading} /> : null}
      {tab === "calendar" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(calendar ?? []).map((l) => (
            <div key={l._id} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium">{typeof l.employeeId === "object" ? `${l.employeeId.firstName} ${l.employeeId.lastName}` : "Employee"}</p>
              <p className="text-sm capitalize text-muted-foreground">{l.type} — {l.totalDays} days</p>
              <p className="text-xs">{new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === "holidays" ? (
        <p className="text-sm text-muted-foreground">Manage holidays via Settings → Branches. Company-wide and branch-specific holidays supported.</p>
      ) : null}

      <Modal open={requestOpen} onOpenChange={setRequestOpen} title="Request Leave" footer={
        <Button loading={requestMut.isPending} onClick={() => requestMut.mutate()}>Submit</Button>
      }>
        <div className="space-y-4">
          <div><Label>Leave Type *</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={LEAVE_TYPES} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div><Label>Reason *</Label><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></div>
        </div>
      </Modal>

      <Modal open={rejectOpen} onOpenChange={setRejectOpen} title="Reject Leave" size="sm" footer={
        <Button variant="primary" className="bg-destructive" loading={rejectMut.isPending} onClick={() => rejectMut.mutate()}>Reject</Button>
      }>
        <div>
          <Label>Rejection Reason *</Label>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </div>
      </Modal>
    </div>
  );
}
