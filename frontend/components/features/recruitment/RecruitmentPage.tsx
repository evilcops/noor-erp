"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Download, Eye, FileText, LayoutGrid, List, Plus, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RecruitmentPipeline } from "@/components/features/recruitment/RecruitmentPipeline";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { companyApi } from "@/lib/api/companies";
import { recruitmentApi } from "@/lib/api/recruitment";
import { getAccessToken } from "@/lib/api/token";
import { cn } from "@/lib/utils";
import { FileUpload } from "@/components/common/FileUpload";
import type { Candidate, CandidateStatus } from "@/types/recruitment";

const PIPELINE: CandidateStatus[] = [
  "new",
  "shortlisted",
  "interview_scheduled",
  "interviewed",
  "offered",
  "accepted",
  "hired",
  "rejected",
  "archived",
];

const STATUS_FILTER = [
  { value: "", label: "All statuses" },
  ...PIPELINE.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
];

const emptyCandidateForm = {
  position: "",
  department: "",
  candidateName: "",
  candidateEmail: "",
  candidatePhone: "",
  notes: "",
};

const emptyInterviewForm = {
  date: "",
  time: "",
  mode: "in_person" as "online" | "in_person",
  meetingLink: "",
};

const emptyFeedbackForm = {
  rating: "3",
  feedback: "",
};

function formatInterviewDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RecruitmentPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { branches, activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();

  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [selected, setSelected] = useState<Candidate | null>(null);
  const [detailTab, setDetailTab] = useState("overview");

  const [form, setForm] = useState(emptyCandidateForm);
  const [addCompanyId, setAddCompanyId] = useState("");
  const [addBranchId, setAddBranchId] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | undefined>(undefined);
  const [cvViewerOpen, setCvViewerOpen] = useState(false);

  const [interviewForm, setInterviewForm] = useState(emptyInterviewForm);
  const [feedbackForm, setFeedbackForm] = useState(emptyFeedbackForm);

  const isSuperAdmin = user?.role === "super_admin";

  const activeBranch = useMemo(
    () => branches.find((b) => b._id === activeBranchId),
    [branches, activeBranchId]
  );

  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyApi.getAll(),
    enabled: isSuperAdmin && !!user,
  });

  const companies = companiesData?.data ?? [];

  const addBranchOptions = useMemo(() => {
    const companyId = addCompanyId || user?.companyId || activeBranch?.companyId;
    if (!companyId) return branches;
    return branches.filter((b) => b.companyId === companyId);
  }, [addCompanyId, branches, user?.companyId, activeBranch?.companyId]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["candidates", search, statusFilter, branchFilter, activeBranchId],
    queryFn: () =>
      recruitmentApi.getCandidates({
        search: search || undefined,
        status: statusFilter || undefined,
        branchId: branchFilter || activeBranchId || undefined,
        limit: 100,
      }),
    enabled: !authLoading && !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!selected) return;
    setInterviewForm({
      date: selected.interviewSchedule?.date?.slice(0, 10) ?? "",
      time: selected.interviewSchedule?.time ?? "",
      mode: (selected.interviewSchedule?.mode as "online" | "in_person") ?? "in_person",
      meetingLink: selected.interviewSchedule?.meetingLink ?? "",
    });
    setFeedbackForm({
      rating: String(selected.interviewSchedule?.rating ?? 3),
      feedback: selected.interviewSchedule?.feedback ?? "",
    });
  }, [selected]);

  const refreshSelected = async (id: string) => {
    const updated = await recruitmentApi.getById(id);
    setSelected(updated);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const companyId = addCompanyId || user?.companyId || activeBranch?.companyId;
      const branchId = addBranchId || activeBranchId;
      if (!companyId || !branchId) {
        throw new Error("Select a company and branch before adding a candidate");
      }
      if (!form.position || !form.candidateName || !form.candidateEmail) {
        throw new Error("Position, name, and email are required");
      }
      if (!cvFile) {
        setCvError("CV / Resume is required");
        throw new Error("CV / Resume is required");
      }

      // Step 1: create candidate record
      const candidate = await recruitmentApi.create({ ...form, companyId, branchId });

      // Step 2: upload CV file
      const fd = new FormData();
      fd.append("file", cvFile);
      await recruitmentApi.uploadCV(candidate._id, fd);

      return candidate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Candidate added with CV");
      setAddOpen(false);
      setForm(emptyCandidateForm);
      setAddCompanyId("");
      setAddBranchId("");
      setCvFile(null);
      setCvError(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) =>
      recruitmentApi.updateStatus(id, status),
    onSuccess: async (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      if (selected?._id === id) await refreshSelected(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleMut = useMutation({
    mutationFn: (id: string) => {
      if (!interviewForm.date || !interviewForm.time) {
        throw new Error("Interview date and time are required");
      }
      if (interviewForm.mode === "online" && !interviewForm.meetingLink.trim()) {
        throw new Error("Meeting link is required for online interviews");
      }
      return recruitmentApi.scheduleInterview(id, {
        date: interviewForm.date,
        time: interviewForm.time,
        mode: interviewForm.mode,
        meetingLink: interviewForm.meetingLink || undefined,
        interviewerId: user?.id,
      });
    },
    onSuccess: async (_, id) => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Interview scheduled");
      await refreshSelected(id);
      setDetailTab("interview");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const feedbackMut = useMutation({
    mutationFn: (id: string) => {
      if (!feedbackForm.feedback.trim()) {
        throw new Error("Interview feedback is required");
      }
      return recruitmentApi.interviewFeedback(id, {
        feedback: feedbackForm.feedback.trim(),
        rating: Number(feedbackForm.rating),
      });
    },
    onSuccess: async (_, id) => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Interview feedback saved");
      await refreshSelected(id);
      setDetailTab("decision");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hireMut = useMutation({
    mutationFn: (id: string) => recruitmentApi.convertToEmployee(id),
    onSuccess: async (_, id) => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Candidate hired and added as employee");
      await refreshSelected(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      recruitmentApi.update(id, {
        status: "rejected",
        notes: reason || "Not selected after interview",
      }),
    onSuccess: async (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Candidate rejected");
      setRejectOpen(false);
      setRejectReason("");
      await refreshSelected(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<Candidate>[] = [
    { key: "name", header: "Name", cell: (r) => r.candidateName ?? "—" },
    { key: "email", header: "Email", cell: (r) => r.candidateEmail ?? "—" },
    { key: "position", header: "Position", cell: (r) => r.position ?? "—" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "interview",
      header: "Interview",
      cell: (r) =>
        r.interviewSchedule?.date
          ? `${formatInterviewDate(r.interviewSchedule.date)} ${r.interviewSchedule.time ?? ""}`
          : "—",
    },
    {
      key: "date",
      header: "Applied",
      cell: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <Button
          variant="ghost"
          onClick={() => {
            setSelected(r);
            setDetailTab("overview");
            setDetailOpen(true);
          }}
        >
          Manage
        </Button>
      ),
    },
  ];

  const candidates = data?.data ?? [];
  const canManage = can("recruitment:edit") || can("recruitment:create");

  const openCandidate = (candidate: Candidate) => {
    setSelected(candidate);
    setDetailTab("overview");
    setDetailOpen(true);
  };

  async function downloadCV(url: string) {
    try {
      const token = getAccessToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = url.split("/").pop() ?? "cv";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Could not download CV");
    }
  }

  return (
    <div>
      <PageHeader
        title="Recruitment"
        description="Schedule interviews, record feedback, and hire or reject candidates."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Recruitment" }]}
        actions={
          can("recruitment:create") ? (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Button>
          ) : undefined
        }
      />

      {isError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          Could not load candidates.
          <Button variant="ghost" onClick={() => refetch()} className="ml-2">
            Retry
          </Button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search candidates..." />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_FILTER}
          className="w-44"
        />
        <Select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          options={[
            { value: "", label: "All branches" },
            ...branches.map((b) => ({ value: b._id, label: b.name })),
          ]}
          className="w-48"
        />
        <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              view === "kanban"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
            title="Pipeline view"
          >
            <LayoutGrid className="h-4 w-4" />
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              view === "table"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
            title="Table view"
          >
            <List className="h-4 w-4" />
            Table
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <RecruitmentPipeline
          candidates={candidates}
          loading={isLoading || authLoading}
          onSelect={openCandidate}
          statusFilter={statusFilter || undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={candidates}
          loading={isLoading || authLoading}
          onRowClick={openCandidate}
        />
      )}

      <Modal
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) { setCvFile(null); setCvError(undefined); }
        }}
        title="Add Candidate"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>
              Add
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {isSuperAdmin ? (
            <>
              <div>
                <Label>Company *</Label>
                <Select
                  value={addCompanyId}
                  onChange={(e) => {
                    setAddCompanyId(e.target.value);
                    setAddBranchId("");
                  }}
                  options={[
                    { value: "", label: "Select company" },
                    ...companies.map((c) => ({ value: c._id, label: c.name })),
                  ]}
                />
              </div>
              <div>
                <Label>Branch *</Label>
                <Select
                  value={addBranchId}
                  onChange={(e) => setAddBranchId(e.target.value)}
                  options={[
                    { value: "", label: "Select branch" },
                    ...addBranchOptions.map((b) => ({ value: b._id, label: b.name })),
                  ]}
                />
              </div>
            </>
          ) : null}
          <div>
            <Label>Position *</Label>
            <Input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
          </div>
          <div>
            <Label>Department</Label>
            <Input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </div>
          <div>
            <Label>Name *</Label>
            <Input
              value={form.candidateName}
              onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
            />
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.candidateEmail}
              onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.candidatePhone}
              onChange={(e) => setForm({ ...form, candidatePhone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          {/* CV Upload — required */}
          <div className="sm:col-span-2">
            <Label>
              CV / Resume <span className="text-destructive">*</span>
            </Label>
            {cvFile ? (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{cvFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(cvFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setCvFile(null); setCvError(undefined); }}
                  className="ml-2 text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : null}
            <FileUpload
              accept=".pdf,.doc,.docx"
              label={cvFile ? "Replace CV" : "Upload CV / Resume (PDF or Word)"}
              onFileSelect={(f) => { setCvFile(f); setCvError(undefined); }}
              error={cvError}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={selected?.candidateName ?? "Candidate"}
        size="xl"
      >
        {selected ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-sm text-muted-foreground">{selected.position}</span>
            </div>

            <Tabs
              tabs={[
                { id: "overview", label: "Overview" },
                { id: "interview", label: "Schedule Interview" },
                { id: "feedback", label: "Interview Feedback" },
                { id: "decision", label: "Hire / Reject" },
              ]}
              activeTab={detailTab}
              onChange={setDetailTab}
              className="mb-4"
            />

            {detailTab === "overview" ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {selected.candidateEmail}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {selected.candidatePhone ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Department:</span>{" "}
                    {selected.department ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Applied:</span>{" "}
                    {new Date(selected.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {selected.notes ? (
                  <p>
                    <span className="text-muted-foreground">Notes:</span> {selected.notes}
                  </p>
                ) : null}

                {/* CV section */}
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 font-medium">CV / Resume</p>
                  {selected.resumeUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCvViewerOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" />
                        View CV
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCV(selected.resumeUrl!)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">No CV uploaded yet.</p>
                  )}
                </div>

                {canManage && selected.status === "new" ? (
                  <Button
                    variant="secondary"
                    onClick={() => statusMut.mutate({ id: selected._id, status: "shortlisted" })}
                  >
                    Move to Shortlisted
                  </Button>
                ) : null}
              </div>
            ) : null}

            {detailTab === "interview" ? (
              <div className="space-y-4">
                {selected.interviewSchedule?.date ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Current schedule</p>
                    <p>Date: {formatInterviewDate(selected.interviewSchedule.date)}</p>
                    <p>Time: {selected.interviewSchedule.time ?? "—"}</p>
                    <p className="capitalize">Mode: {selected.interviewSchedule.mode ?? "—"}</p>
                    {selected.interviewSchedule.meetingLink ? (
                      <a
                        href={selected.interviewSchedule.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline"
                      >
                        {selected.interviewSchedule.meetingLink}
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {canManage && !["hired", "rejected", "archived"].includes(selected.status) ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Interview date *</Label>
                      <Input
                        type="date"
                        value={interviewForm.date}
                        onChange={(e) =>
                          setInterviewForm({ ...interviewForm, date: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Interview time *</Label>
                      <Input
                        type="time"
                        value={interviewForm.time}
                        onChange={(e) =>
                          setInterviewForm({ ...interviewForm, time: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Mode *</Label>
                      <Select
                        value={interviewForm.mode}
                        onChange={(e) =>
                          setInterviewForm({
                            ...interviewForm,
                            mode: e.target.value as "online" | "in_person",
                          })
                        }
                        options={[
                          { value: "in_person", label: "In person" },
                          { value: "online", label: "Online" },
                        ]}
                      />
                    </div>
                    <div>
                      <Label>
                        Meeting link {interviewForm.mode === "online" ? "*" : "(optional)"}
                      </Label>
                      <Input
                        value={interviewForm.meetingLink}
                        onChange={(e) =>
                          setInterviewForm({ ...interviewForm, meetingLink: e.target.value })
                        }
                        placeholder="https://meet.google.com/..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        loading={scheduleMut.isPending}
                        onClick={() => scheduleMut.mutate(selected._id)}
                      >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {selected.interviewSchedule?.date ? "Update interview" : "Schedule interview"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Interview scheduling is not available for this candidate status.
                  </p>
                )}
              </div>
            ) : null}

            {detailTab === "feedback" ? (
              <div className="space-y-4">
                {selected.status === "interview_scheduled" ||
                selected.status === "interviewed" ||
                selected.interviewSchedule?.feedback ? (
                  canManage && !["hired", "rejected", "archived"].includes(selected.status) ? (
                    <>
                      <div>
                        <Label>Rating (1–5) *</Label>
                        <Select
                          value={feedbackForm.rating}
                          onChange={(e) =>
                            setFeedbackForm({ ...feedbackForm, rating: e.target.value })
                          }
                          options={[1, 2, 3, 4, 5].map((n) => ({
                            value: String(n),
                            label: `${n} — ${["Poor", "Fair", "Good", "Very good", "Excellent"][n - 1]}`,
                          }))}
                        />
                      </div>
                      <div>
                        <Label>Interview feedback *</Label>
                        <textarea
                          value={feedbackForm.feedback}
                          onChange={(e) =>
                            setFeedbackForm({ ...feedbackForm, feedback: e.target.value })
                          }
                          rows={5}
                          placeholder="Summarize the interview: strengths, concerns, recommendation..."
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                        />
                      </div>
                      <Button
                        loading={feedbackMut.isPending}
                        onClick={() => feedbackMut.mutate(selected._id)}
                      >
                        Save interview feedback
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm">
                      {selected.interviewSchedule?.feedback ? (
                        <>
                          <p className="mb-2 font-medium">
                            Rating: {selected.interviewSchedule.rating ?? "—"}/5
                          </p>
                          <p>{selected.interviewSchedule.feedback}</p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">No feedback recorded yet.</p>
                      )}
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Schedule an interview first, then record feedback after conducting it.
                  </p>
                )}
              </div>
            ) : null}

            {detailTab === "decision" ? (
              <div className="space-y-4">
                {selected.interviewSchedule?.feedback ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Interview summary</p>
                    <p>Rating: {selected.interviewSchedule.rating ?? "—"}/5</p>
                    <p className="mt-1">{selected.interviewSchedule.feedback}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add interview feedback before making a hiring decision.
                  </p>
                )}

                {selected.status === "hired" ? (
                  <p className="text-sm font-medium text-emerald-700">
                    This candidate has been hired and converted to an employee.
                  </p>
                ) : null}

                {selected.status === "rejected" ? (
                  <p className="text-sm font-medium text-red-700">
                    This candidate was rejected.
                    {selected.notes ? ` Reason: ${selected.notes}` : null}
                  </p>
                ) : null}

                {canManage &&
                selected.status !== "hired" &&
                selected.status !== "rejected" &&
                selected.interviewSchedule?.feedback ? (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      loading={hireMut.isPending}
                      onClick={() => hireMut.mutate(selected._id)}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      Hire candidate
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-red-700 hover:text-red-800"
                      onClick={() => setRejectOpen(true)}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Reject candidate
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>

      {/* CV inline viewer */}
      {cvViewerOpen && selected?.resumeUrl ? (
        <CvViewerModal
          url={selected.resumeUrl}
          name={selected.candidateName}
          onClose={() => setCvViewerOpen(false)}
          onDownload={() => downloadCV(selected.resumeUrl!)}
        />
      ) : null}

      <Modal
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject candidate"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={rejectMut.isPending}
              className="bg-destructive hover:opacity-90"
              onClick={() => {
                if (!selected) return;
                rejectMut.mutate({ id: selected._id, reason: rejectReason });
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This candidate will be marked as rejected and removed from the active hiring pipeline.
        </p>
        <div className="mt-3">
          <Label>Reason (optional)</Label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="e.g. Does not meet experience requirements"
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── CV Viewer ───────────────────────────────────────────────────────────────

function CvViewerModal({
  url,
  name,
  onClose,
  onDownload,
}: {
  url: string;
  name: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPdf = url.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    let objectUrl: string | undefined;
    async function load() {
      try {
        const token = getAccessToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load CV");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">{name} — CV</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onDownload}>
              <Download className="mr-1.5 h-4 w-4" />
              Download
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading CV…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : blobUrl && isPdf ? (
            <iframe src={blobUrl} className="h-full w-full" title="CV preview" />
          ) : blobUrl ? (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <FileText className="h-14 w-14 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This file type cannot be previewed inline.
              </p>
              <Button onClick={onDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                Download to view
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
