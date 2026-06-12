"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { recruitmentApi } from "@/lib/api/recruitment";
import type { Candidate, CandidateStatus } from "@/types/recruitment";

const PIPELINE: CandidateStatus[] = [
  "new", "shortlisted", "interview_scheduled", "interviewed",
  "offered", "accepted", "hired", "rejected", "archived",
];

export function RecruitmentPage() {
  const { user } = useAuth();
  const { branches, activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();

  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [form, setForm] = useState({ position: "", department: "", candidateName: "", candidateEmail: "", candidatePhone: "", notes: "", source: "website" });

  const { data, isLoading } = useQuery({
    queryKey: ["candidates", search],
    queryFn: () => recruitmentApi.getCandidates({ search, limit: 100 }),
  });

  const createMut = useMutation({
    mutationFn: () => recruitmentApi.create({
      ...form,
      companyId: user!.companyId!,
      branchId: activeBranchId!,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["candidates"] }); toast.success("Candidate added"); setAddOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) =>
      recruitmentApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<Candidate>[] = [
    { key: "name", header: "Name", cell: (r) => r.candidateName },
    { key: "email", header: "Email", cell: (r) => r.candidateEmail },
    { key: "phone", header: "Phone", cell: (r) => r.candidatePhone ?? "—" },
    { key: "position", header: "Position", cell: (r) => r.position },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "date", header: "Applied", cell: (r) => new Date(r.createdAt).toLocaleDateString() },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <Button variant="ghost" onClick={() => { setSelected(r); setDetailOpen(true); }}>View</Button>
      ),
    },
  ];

  const candidates = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Recruitment"
        description="Manage your hiring pipeline from application to hire."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Recruitment" }]}
        actions={
          can("recruitment:create") ? (
            <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Candidate</Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search candidates..." />
        </div>
        <div className="flex rounded-lg border border-border">
          <button onClick={() => setView("kanban")} className={`px-3 py-2 ${view === "kanban" ? "bg-muted" : ""}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView("table")} className={`px-3 py-2 ${view === "table" ? "bg-muted" : ""}`}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE.map((status) => (
            <div key={status} className="min-w-[220px] flex-shrink-0 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {status.replace(/_/g, " ")}
                <span className="ml-1 text-foreground">({candidates.filter((c) => c.status === status).length})</span>
              </h3>
              <div className="space-y-2">
                {candidates.filter((c) => c.status === status).map((c) => (
                  <div
                    key={c._id}
                    className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow"
                    onClick={() => { setSelected(c); setDetailOpen(true); }}
                  >
                    <p className="font-medium text-sm">{c.candidateName}</p>
                    <p className="text-xs text-muted-foreground">{c.position}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</p>
                    {can("recruitment:edit") ? (
                      <select
                        className="mt-2 w-full rounded border border-border text-xs"
                        value={c.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => statusMut.mutate({ id: c._id, status: e.target.value as CandidateStatus })}
                      >
                        {PIPELINE.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                      </select>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable columns={columns} data={candidates} loading={isLoading} onRowClick={(r) => { setSelected(r); setDetailOpen(true); }} />
      )}

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add Candidate" footer={
        <>
          <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>Add</Button>
        </>
      }>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Position *</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div><Label>Name *</Label><Input value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} /></div>
          <div><Label>Email *</Label><Input type="email" value={form.candidateEmail} onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.candidatePhone} onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })} /></div>
          <div><Label>Source</Label><Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} options={[
            { value: "linkedin", label: "LinkedIn" }, { value: "indeed", label: "Indeed" },
            { value: "referral", label: "Referral" }, { value: "website", label: "Website" }, { value: "other", label: "Other" },
          ]} /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm" /></div>
        </div>
      </Modal>

      <Modal open={detailOpen} onOpenChange={setDetailOpen} title={selected?.candidateName ?? "Candidate"} size="xl">
        {selected ? (
          <>
            <Tabs tabs={[
              { id: "info", label: "Information" },
              { id: "interview", label: "Interview" },
              { id: "feedback", label: "Feedback" },
              { id: "offer", label: "Offer" },
            ]} activeTab={detailTab} onChange={setDetailTab} className="mb-4" />
            {detailTab === "info" ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Position:</span> {selected.position}</p>
                <p><span className="text-muted-foreground">Email:</span> {selected.candidateEmail}</p>
                <p><span className="text-muted-foreground">Phone:</span> {selected.candidatePhone ?? "—"}</p>
                <StatusBadge status={selected.status} />
                {selected.resumeUrl ? <a href={selected.resumeUrl} className="text-brand underline">Download Resume</a> : null}
              </div>
            ) : null}
            {detailTab === "interview" && selected.interviewSchedule ? (
              <div className="text-sm space-y-1">
                <p>Date: {selected.interviewSchedule.date}</p>
                <p>Time: {selected.interviewSchedule.time}</p>
                <p>Mode: {selected.interviewSchedule.mode}</p>
                {selected.interviewSchedule.meetingLink ? <a href={selected.interviewSchedule.meetingLink} className="text-brand">{selected.interviewSchedule.meetingLink}</a> : null}
              </div>
            ) : detailTab === "interview" ? <p className="text-sm text-muted-foreground">No interview scheduled.</p> : null}
            {detailTab === "feedback" ? (
              <div className="text-sm">
                {selected.interviewSchedule?.feedback ? <p>{selected.interviewSchedule.feedback}</p> : <p className="text-muted-foreground">No feedback yet.</p>}
                {selected.interviewSchedule?.rating ? <p>Rating: {selected.interviewSchedule.rating}/5</p> : null}
              </div>
            ) : null}
            {detailTab === "offer" ? (
              <div className="text-sm space-y-2">
                {selected.offerDetails ? (
                  <>
                    <p>Salary: {selected.offerDetails.salary}</p>
                    <p>Joining: {selected.offerDetails.joiningDate}</p>
                    <p>Status: {selected.offerDetails.status}</p>
                  </>
                ) : <p className="text-muted-foreground">No offer details.</p>}
                {selected.status === "hired" && can("recruitment:create") ? (
                  <Button onClick={async () => {
                    await recruitmentApi.convertToEmployee(selected._id);
                    toast.success("Converted to employee");
                    qc.invalidateQueries({ queryKey: ["candidates"] });
                  }}>Convert to Employee</Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>
    </div>
  );
}
