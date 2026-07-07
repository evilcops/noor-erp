"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { BranchSubBranchSelect } from "@/components/common/BranchSubBranchSelect";
import { Select } from "@/components/ui/Select";
import { effectiveBranchId, resolveMainAndSubBranchId } from "@/lib/branch-utils";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmployees } from "@/hooks/useEmployees";
import { businessDocApi } from "@/lib/api/businessDocuments";
import { branchDocApi } from "@/lib/api/branchDocuments";
import { getAccessToken } from "@/lib/api/token";
import type { BusinessDocument, BranchDocument, BusinessDocType, BranchDocType } from "@/types/documents";
import type { Employee } from "@/types/employee";
import { employeeApi } from "@/lib/api/employees";
import { formatDate } from "@/lib/date";

// ─── Label maps ──────────────────────────────────────────────────────────────

const BIZ_DOC_LABELS: Record<string, string> = {
  cr_certificate: "CR Certificate",
  chamber_of_commerce: "Chamber of Commerce",
  custom: "Custom Document",
};

const BRANCH_DOC_LABELS: Record<string, string> = {
  property_license: "Property License",
  baladiya_license: "Baladiya (Municipal) License",
  pat_testing: "PAT Testing",
  smoke_alarm: "Smoke Alarm",
  building_insurance: "Building Insurance",
  fire_policy: "Fire Policy",
  money_policy: "Money Policy",
  custom: "Custom Document",
};

const BIZ_TYPES = [
  { value: "cr_certificate", label: "CR Certificate" },
  { value: "chamber_of_commerce", label: "Chamber of Commerce" },
  { value: "custom", label: "Custom Document" },
];

const BRANCH_TYPES = [
  { value: "property_license", label: "Property License" },
  { value: "baladiya_license", label: "Baladiya (Municipal) License" },
  { value: "pat_testing", label: "PAT Testing" },
  { value: "smoke_alarm", label: "Smoke Alarm" },
  { value: "building_insurance", label: "Building Insurance" },
  { value: "fire_policy", label: "Fire Policy" },
  { value: "money_policy", label: "Money Policy" },
  { value: "custom", label: "+ Add New Custom Type" },
];

function statusColor(status?: string) {
  if (status === "expired") return "text-destructive";
  if (status === "expiring_soon") return "text-amber-600";
  return "text-emerald-600";
}

function daysLeft(expiry?: string) {
  if (!expiry) return null;
  const d = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return "Expired";
  return `${d}d left`;
}

// ─── Shared doc viewer ───────────────────────────────────────────────────────

function ViewerModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPdf = url.toLowerCase().endsWith(".pdf");

  useState(() => {
    let obj: string | undefined;
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        obj = URL.createObjectURL(blob);
        setBlobUrl(obj);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load file");
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (obj) URL.revokeObjectURL(obj); };
  });

  async function download() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = url.split("/").pop() ?? "document";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="font-semibold">{title}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={download}><Download className="mr-1.5 h-4 w-4" />Download</Button>
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">✕</button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : error ? <p className="text-sm text-destructive">{error}</p>
            : blobUrl && isPdf ? <iframe src={blobUrl} className="h-full w-full" title={title} />
            : blobUrl ? (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <FileText className="h-14 w-14 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">This file type cannot be previewed inline.</p>
                <Button onClick={download}><Download className="mr-1.5 h-4 w-4" />Download to view</Button>
              </div>
            ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Employee Documents Tab ───────────────────────────────────────────────────

const EMP_DOC_LABELS: Record<string, string> = {
  passport: "Passport",
  driving_license: "Driving License",
  bataka: "Bataka (ID Card)",
  mulkiya: "Mulkiya (Vehicle Reg.)",
  car_insurance: "Car Insurance",
};

function EmployeeDocumentsTab() {
  const { data } = useEmployees({ limit: 200, status: "active" });
  const employees = data?.data ?? [];
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");

  return (
    <div className="space-y-4">
      {viewerUrl ? (
        <ViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      ) : null}

      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active employees found.</p>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => {
            const complianceDocs = emp.documents?.filter((d) =>
              ["passport", "driving_license", "bataka", "mulkiya", "car_insurance"].includes(d.type)
            ) ?? [];

            return (
              <div key={emp._id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    {emp.profilePicture ? (
                      <img src={emp.profilePicture} alt={emp.firstName} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-muted-foreground">{emp.employeeId} · {emp.department ?? "—"}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${complianceDocs.length === 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {complianceDocs.length} doc{complianceDocs.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {complianceDocs.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">No compliance documents uploaded.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {complianceDocs.map((doc) => (
                      <div key={doc._id ?? doc.type} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                        <div>
                          <p className="font-medium">{EMP_DOC_LABELS[doc.type] ?? doc.type}</p>
                          {doc.expiryDate ? (
                            <p className={statusColor(doc.status)}>
                              Expires {formatDate(doc.expiryDate)} · {daysLeft(doc.expiryDate)}
                            </p>
                          ) : <p className="text-muted-foreground">No expiry set</p>}
                        </div>
                        {doc.fileUrl ? (
                          <button
                            type="button"
                            onClick={() => { setViewerUrl(doc.fileUrl!); setViewerTitle(`${emp.firstName} — ${EMP_DOC_LABELS[doc.type] ?? doc.type}`); }}
                            className="ml-2 text-brand hover:underline"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="ml-2 italic text-muted-foreground/60">No file</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Family members */}
                {emp.familyType === "family" && (emp.familyMembers ?? []).length > 0 ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Family Members</p>
                    <div className="space-y-2">
                      {emp.familyMembers!.map((m) => (
                        <div key={m._id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                          <div>
                            <p className="font-medium capitalize">{m.name} <span className="text-muted-foreground">({m.relationship})</span></p>
                            {m.bataka?.expiryDate ? (
                              <p className={statusColor(m.bataka.status)}>
                                Bataka expires {formatDate(m.bataka.expiryDate)} · {daysLeft(m.bataka.expiryDate)}
                              </p>
                            ) : <p className="text-muted-foreground">No Bataka expiry set</p>}
                          </div>
                          {m.bataka?.fileUrl ? (
                            <button type="button" onClick={() => { setViewerUrl(m.bataka!.fileUrl!); setViewerTitle(`${m.name} — Bataka`); }} className="ml-2 text-brand">
                              <Eye className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Business Documents Tab ───────────────────────────────────────────────────

const emptyBizForm = { type: "cr_certificate", customTypeName: "", startDate: "", expiryDate: "", notes: "" };

function BusinessDocumentsTab() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessDocument | null>(null);
  const [form, setForm] = useState(emptyBizForm);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["business-docs"],
    queryFn: () => businessDocApi.list(),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        type: form.type as BusinessDocType,
        startDate: form.startDate,
        expiryDate: form.expiryDate,
        notes: form.notes,
        customTypeName: form.type === "custom" ? form.customTypeName : undefined,
      };
      return selected
        ? businessDocApi.update(selected._id, payload)
        : businessDocApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-docs"] });
      toast.success(selected ? "Document updated" : "Document added");
      setFormOpen(false);
      setSelected(null);
      setForm(emptyBizForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => businessDocApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-docs"] });
      toast.success("Document deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFileUpload(doc: BusinessDocument, file: File) {
    setUploadingId(doc._id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await businessDocApi.uploadFile(doc._id, fd);
      qc.invalidateQueries({ queryKey: ["business-docs"] });
      toast.success("File uploaded");
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  function openEdit(doc: BusinessDocument) {
    setSelected(doc);
    setForm({
      type: doc.type,
      customTypeName: doc.customTypeName ?? "",
      startDate: doc.startDate?.slice(0, 10) ?? "",
      expiryDate: doc.expiryDate?.slice(0, 10) ?? "",
      notes: doc.notes ?? "",
    });
    setFormOpen(true);
  }

  const docs = data?.data ?? [];

  return (
    <div className="space-y-4">
      {viewerUrl ? (
        <ViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      ) : null}

      <div className="flex justify-end">
        {can("employee:edit") ? (
          <Button onClick={() => { setSelected(null); setForm(emptyBizForm); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add Document
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No business documents yet.</p>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc._id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="font-medium text-sm">
                    {doc.type === "custom" ? doc.customTypeName : BIZ_DOC_LABELS[doc.type]}
                  </p>
                  <StatusBadge status={doc.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-0.5 text-xs text-muted-foreground">
                  {doc.startDate ? <span>Start: {formatDate(doc.startDate)}</span> : null}
                  {doc.expiryDate ? (
                    <span className={statusColor(doc.status)}>
                      Expires: {formatDate(doc.expiryDate)} · {daysLeft(doc.expiryDate)}
                    </span>
                  ) : <span>No expiry set</span>}
                </div>
                {doc.notes ? <p className="mt-1 text-xs text-muted-foreground">{doc.notes}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {doc.fileUrl ? (
                  <button type="button" onClick={() => { setViewerUrl(doc.fileUrl!); setViewerTitle(BIZ_DOC_LABELS[doc.type] ?? doc.customTypeName ?? "Document"); }} className="rounded-md border border-border p-1.5 hover:bg-muted">
                    <Eye className="h-4 w-4" />
                  </button>
                ) : null}
                {can("employee:edit") ? (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-md border border-border p-1.5 hover:bg-muted"
                      title="Upload file"
                      disabled={uploadingId === doc._id}
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(doc, f);
                        e.target.value = "";
                      }}
                    />
                    <button type="button" onClick={() => openEdit(doc)} className="rounded-md border border-border p-1.5 hover:bg-muted">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => deleteMut.mutate(doc._id)} className="rounded-md border border-border p-1.5 hover:bg-muted text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selected ? "Edit Business Document" : "Add Business Document"}
        footer={
          <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {selected ? "Save Changes" : "Add Document"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Document Type *</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={BIZ_TYPES}
            />
          </div>
          {form.type === "custom" ? (
            <div>
              <Label>Custom Type Name *</Label>
              <Input
                value={form.customTypeName}
                onChange={(e) => setForm({ ...form, customTypeName: e.target.value })}
                placeholder="Enter document type name…"
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Branch Documents Tab ─────────────────────────────────────────────────────

const emptyBranchForm = {
  branchId: "",
  type: "property_license",
  customTypeName: "",
  issuanceDate: "",
  expiryDate: "",
  notes: "",
};

function BranchDocumentsTab() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const { branches } = useBranch();
  const [mainBranchFilter, setMainBranchFilter] = useState("");
  const [subBranchFilter, setSubBranchFilter] = useState("");
  const branchFilter = effectiveBranchId(mainBranchFilter, subBranchFilter);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<BranchDocument | null>(null);
  const [form, setForm] = useState(emptyBranchForm);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["branch-docs", branchFilter],
    queryFn: () => branchDocApi.list({ branchId: branchFilter || undefined }),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        type: form.type as BranchDocType,
        issuanceDate: form.issuanceDate,
        expiryDate: form.expiryDate,
        notes: form.notes,
        customTypeName: form.type === "custom" ? form.customTypeName : undefined,
      };
      return selected
        ? branchDocApi.update(selected._id, payload)
        : branchDocApi.create({ ...payload, branchId: form.branchId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-docs"] });
      toast.success(selected ? "Document updated" : "Document added");
      setFormOpen(false);
      setSelected(null);
      setForm(emptyBranchForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => branchDocApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-docs"] });
      toast.success("Document deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFileUpload(doc: BranchDocument, file: File) {
    setUploadingId(doc._id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await branchDocApi.uploadFile(doc._id, fd);
      qc.invalidateQueries({ queryKey: ["branch-docs"] });
      toast.success("File uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  function openEdit(doc: BranchDocument) {
    setSelected(doc);
    setForm({
      branchId: doc.branchId,
      type: doc.type,
      customTypeName: doc.customTypeName ?? "",
      issuanceDate: doc.issuanceDate?.slice(0, 10) ?? "",
      expiryDate: doc.expiryDate?.slice(0, 10) ?? "",
      notes: doc.notes ?? "",
    });
    setFormOpen(true);
  }

  const docs = data?.data ?? [];

  return (
    <div className="space-y-4">
      {viewerUrl ? (
        <ViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        />
        {can("employee:edit") ? (
          <Button onClick={() => { setSelected(null); setForm({ ...emptyBranchForm, branchId: branchFilter || (branches[0]?._id ?? "") }); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add Document
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branch documents yet.</p>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const branch = doc as BranchDocument & { branchId: { name?: string } | string };
            const branchName = typeof branch.branchId === "object" ? (branch.branchId as { name?: string }).name ?? "Unknown" : "";

            return (
              <div key={doc._id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="font-medium text-sm">
                      {doc.type === "custom" ? doc.customTypeName : BRANCH_DOC_LABELS[doc.type]}
                    </p>
                    {branchName ? <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">{branchName}</span> : null}
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-0.5 text-xs text-muted-foreground">
                    {doc.issuanceDate ? <span>Issued: {formatDate(doc.issuanceDate)}</span> : null}
                    {doc.expiryDate ? (
                      <span className={statusColor(doc.status)}>
                        Expires: {formatDate(doc.expiryDate)} · {daysLeft(doc.expiryDate)}
                      </span>
                    ) : <span>No expiry set</span>}
                  </div>
                  {doc.notes ? <p className="mt-1 text-xs text-muted-foreground">{doc.notes}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {doc.fileUrl ? (
                    <button type="button" onClick={() => { setViewerUrl(doc.fileUrl!); setViewerTitle(BRANCH_DOC_LABELS[doc.type] ?? doc.customTypeName ?? "Document"); }} className="rounded-md border border-border p-1.5 hover:bg-muted">
                      <Eye className="h-4 w-4" />
                    </button>
                  ) : null}
                  {can("employee:edit") ? (
                    <>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md border border-border p-1.5 hover:bg-muted" title="Upload file" disabled={uploadingId === doc._id}>
                        <Upload className="h-4 w-4" />
                      </button>
                      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(doc, f); e.target.value = ""; }} />
                      <button type="button" onClick={() => openEdit(doc)} className="rounded-md border border-border p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => deleteMut.mutate(doc._id)} className="rounded-md border border-border p-1.5 hover:bg-muted text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={selected ? "Edit Branch Document" : "Add Branch Document"}
        footer={
          <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()} disabled={!form.branchId}>
            {selected ? "Save Changes" : "Add Document"}
          </Button>
        }
      >
        <div className="space-y-4">
          {!selected ? (
            <div>
              <Label>Branch *</Label>
              <BranchSubBranchSelect
                branches={branches}
                mainBranchId={resolveMainAndSubBranchId(form.branchId, branches).mainId}
                subBranchId={resolveMainAndSubBranchId(form.branchId, branches).subId}
                onMainBranchChange={(id) => setForm({ ...form, branchId: id })}
                onSubBranchChange={(id) => {
                  const mainId = resolveMainAndSubBranchId(form.branchId, branches).mainId;
                  setForm({ ...form, branchId: id || mainId });
                }}
              />
            </div>
          ) : null}
          <div>
            <Label>Document Type *</Label>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={BRANCH_TYPES}
            />
          </div>
          {form.type === "custom" ? (
            <div>
              <Label>Custom Type Name *</Label>
              <Input
                value={form.customTypeName}
                onChange={(e) => setForm({ ...form, customTypeName: e.target.value })}
                placeholder="Enter document type name…"
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Issuance Date</Label>
              <Input type="date" value={form.issuanceDate} onChange={(e) => setForm({ ...form, issuanceDate: e.target.value })} />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Page Root ────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const [tab, setTab] = useState("employee");

  return (
    <div>
      <PageHeader
        title="Document Management"
        description="Employee, Business, and Branch document tracking with expiry alerts."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Documents" }]}
      />

      <Tabs
        tabs={[
          { id: "employee", label: "Employee Documents" },
          { id: "business", label: "Business Documents" },
          { id: "branch", label: "Branch Documents" },
        ]}
        activeTab={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "employee" ? <EmployeeDocumentsTab /> : null}
      {tab === "business" ? <BusinessDocumentsTab /> : null}
      {tab === "branch" ? <BranchDocumentsTab /> : null}
    </div>
  );
}
