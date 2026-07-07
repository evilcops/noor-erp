"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable } from "@/components/common/DataTable";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { BranchFormModal } from "@/components/features/branches/BranchFormModal";
import { branchDocApi } from "@/lib/api/branchDocuments";
import type { BranchDocument, BranchDocType } from "@/types/documents";
import { getAccessToken } from "@/lib/api/token";
import type { BranchesPageTemplateProps } from "./script";
import type { Branch } from "@/types/branch";
import { formatDate } from "@/lib/date";
import styles from "./style.module.css";

// ─── helpers ──────────────────────────────────────────────────────────────────

const BRANCH_DOC_TYPES = [
  { value: "property_license", label: "Property License" },
  { value: "baladiya_license", label: "Baladiya (Municipal) License" },
  { value: "pat_testing", label: "PAT Testing" },
  { value: "smoke_alarm", label: "Smoke Alarm" },
  { value: "building_insurance", label: "Building Insurance" },
  { value: "fire_policy", label: "Fire Policy" },
  { value: "money_policy", label: "Money Policy" },
  { value: "custom", label: "Custom Document" },
];

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

function daysLeft(expiry?: string): { label: string; cls: string } | null {
  if (!expiry) return null;
  const d = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return { label: "Expired", cls: "text-destructive font-semibold" };
  if (d <= 15) return { label: `${d}d left`, cls: "text-destructive font-semibold" };
  if (d <= 45) return { label: `${d}d left`, cls: "text-amber-600 font-semibold" };
  return { label: `${d}d left`, cls: "text-emerald-600" };
}

// ─── Doc viewer ───────────────────────────────────────────────────────────────

function DocViewerModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const isPdf = url.toLowerCase().endsWith(".pdf");

  useState(() => {
    let obj: string | undefined;
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        obj = URL.createObjectURL(await res.blob());
        setBlobUrl(obj);
      } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
      finally { setLoading(false); }
    })();
    return () => { if (obj) URL.revokeObjectURL(obj); };
  });

  function download() {
    if (!blobUrl) return;
    const a = document.createElement("a"); a.href = blobUrl; a.download = url.split("/").pop() ?? "doc"; a.click();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
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
            : err ? <p className="text-sm text-destructive">{err}</p>
            : blobUrl && isPdf ? <iframe src={blobUrl} className="h-full w-full" title={title} />
            : blobUrl ? (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <FileText className="h-14 w-14 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">File cannot be previewed inline.</p>
                <Button onClick={download}><Download className="mr-1.5 h-4 w-4" />Download</Button>
              </div>
            ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── File upload field ────────────────────────────────────────────────────────

function FileUploadField({ file, existingUrl, existingName, onFileChange, onViewExisting }: {
  file: File | null;
  existingUrl?: string;
  existingName?: string;
  onFileChange: (f: File | null) => void;
  onViewExisting?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      {existingUrl && !file ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="truncate max-w-[200px]">{existingName ?? "Attached file"}</span>
          </span>
          <div className="flex items-center gap-2">
            {onViewExisting ? (
              <button type="button" onClick={onViewExisting}
                className="flex items-center gap-1 text-xs text-brand hover:underline">
                <Eye className="h-3.5 w-3.5" />View
              </button>
            ) : null}
            <button type="button" onClick={() => ref.current?.click()}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Replace
            </button>
          </div>
        </div>
      ) : null}

      {!existingUrl || file ? (
        <button type="button" onClick={() => ref.current?.click()}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
          <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            {file ? (
              <>
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — click to change</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Click to upload document</p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG</p>
              </>
            )}
          </div>
          {file ? (
            <span role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onFileChange(null); } }}
              className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10">
              Remove
            </span>
          ) : null}
        </button>
      ) : null}

      <input ref={ref} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
        onChange={(e) => { onFileChange(e.target.files?.[0] ?? null); e.target.value = ""; }} />
    </div>
  );
}

// ─── Branch Documents panel (per branch) ─────────────────────────────────────

const emptyDocForm = { type: "property_license", customTypeName: "", issuanceDate: "", expiryDate: "", notes: "" };

function BranchDocumentsPanel({ branch, canEdit, onClose, initialDocumentId, onDeeplinkHandled }: {
  branch: Branch;
  canEdit: boolean;
  onClose: () => void;
  initialDocumentId?: string;
  onDeeplinkHandled?: () => void;
}) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<BranchDocument | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyDocForm);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["branch-docs", branch._id],
    queryFn: () => branchDocApi.list({ branchId: branch._id }),
  });

  function closeForm() {
    setFormOpen(false);
    setSelected(null);
    setForm(emptyDocForm);
    setDocFile(null);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<BranchDocument> = {
        type: form.type as BranchDocType,
        issuanceDate: form.issuanceDate,
        expiryDate: form.expiryDate,
        notes: form.notes,
        customTypeName: form.type === "custom" ? form.customTypeName : undefined,
      };
      const saved = selected
        ? await branchDocApi.update(selected._id, payload)
        : await branchDocApi.create({ ...payload, branchId: branch._id });

      if (docFile) {
        const fd = new FormData();
        fd.append("file", docFile);
        await branchDocApi.uploadFile(saved._id, fd);
      }
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-docs", branch._id] });
      toast.success(selected ? "Document updated" : "Document added");
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => branchDocApi.delete(selected!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-docs", branch._id] });
      toast.success("Document deleted");
      setDeleteOpen(false);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(doc: BranchDocument) {
    setSelected(doc);
    setForm({
      type: doc.type,
      customTypeName: doc.customTypeName ?? "",
      issuanceDate: doc.issuanceDate?.slice(0, 10) ?? "",
      expiryDate: doc.expiryDate?.slice(0, 10) ?? "",
      notes: doc.notes ?? "",
    });
    setDocFile(null);
    setFormOpen(true);
  }

  function openViewer(url: string, title: string) {
    setViewerUrl(url);
    setViewerTitle(title);
  }

  const docs = data?.data ?? [];
  const openedDocRef = useRef(false);

  useEffect(() => {
    if (!initialDocumentId || !docs.length || openedDocRef.current) return;
    const doc = docs.find((d) => d._id === initialDocumentId);
    if (doc) {
      openedDocRef.current = true;
      openEdit(doc);
      onDeeplinkHandled?.();
    }
  }, [initialDocumentId, docs, onDeeplinkHandled]);

  return (
    <>
      {viewerUrl ? <DocViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} /> : null}

      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold">Branch Documents</h2>
          <p className="text-sm text-muted-foreground">{branch.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button onClick={() => { setSelected(null); setForm(emptyDocForm); setDocFile(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Add Document
            </Button>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No documents yet for this branch.</p>
            <p className="text-xs text-muted-foreground">Add Property License, Baladiya, PAT Testing, insurance, and more.</p>
            {canEdit ? (
              <Button className="mt-2" onClick={() => { setSelected(null); setForm(emptyDocForm); setDocFile(null); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />Add First Document
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const expiry = daysLeft(doc.expiryDate);
              const docLabel = doc.type === "custom" ? (doc.customTypeName ?? "Custom") : BRANCH_DOC_LABELS[doc.type];
              return (
                <div key={doc._id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="font-medium text-sm">{docLabel}</p>
                      <StatusBadge status={doc.status} />
                      {doc.fileUrl ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">File attached</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 border border-amber-200">No file</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-6 text-xs text-muted-foreground">
                      {doc.issuanceDate ? <span>Issued: {formatDate(doc.issuanceDate)}</span> : null}
                      {doc.expiryDate ? (
                        <span className={expiry?.cls ?? ""}>Expires: {formatDate(doc.expiryDate)}{expiry ? ` · ${expiry.label}` : ""}</span>
                      ) : <span>No expiry set</span>}
                    </div>
                    {doc.notes ? <p className="mt-1 text-xs text-muted-foreground">{doc.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {doc.fileUrl ? (
                      <button type="button" title="View document"
                        onClick={() => openViewer(doc.fileUrl!, docLabel)}
                        className="rounded-md border border-border p-1.5 hover:bg-muted">
                        <Eye className="h-4 w-4" />
                      </button>
                    ) : null}
                    {canEdit ? (
                      <>
                        <button type="button" title="Edit" onClick={() => openEdit(doc)}
                          className="rounded-md border border-border p-1.5 hover:bg-muted">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" title="Delete" onClick={() => { setSelected(doc); setDeleteOpen(true); }}
                          className="rounded-md border border-border p-1.5 text-destructive hover:bg-muted">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit modal — z-70 sits above the z-60 drawer */}
      <Modal
        open={formOpen}
        onOpenChange={(o) => { if (!o) closeForm(); else setFormOpen(true); }}
        title={selected ? "Edit Branch Document" : "Add Branch Document"}
        zIndex={70}
        footer={
          <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {selected ? "Save Changes" : "Add Document"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Document Type *</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={BRANCH_DOC_TYPES} />
          </div>
          {form.type === "custom" ? (
            <div>
              <Label>Custom Type Name *</Label>
              <Input value={form.customTypeName} onChange={(e) => setForm({ ...form, customTypeName: e.target.value })} placeholder="e.g. Fire Safety Certificate" />
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
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <Label>Document File</Label>
            <div className="mt-1">
              <FileUploadField
                file={docFile}
                existingUrl={selected?.fileUrl}
                existingName={selected?.fileUrl?.split("/").pop()}
                onFileChange={setDocFile}
                onViewExisting={selected?.fileUrl
                  ? () => openViewer(selected.fileUrl!, BRANCH_DOC_LABELS[selected.type] ?? selected.customTypeName ?? "Document")
                  : undefined}
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Document"
        description="Permanently delete this branch document? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        zIndex={70}
      />
    </>
  );
}

// ─── Main template ────────────────────────────────────────────────────────────

export function BranchesPageTemplate({
  search,
  setSearch,
  page,
  setPage,
  statusFilter,
  setStatusFilter,
  formOpen,
  setFormOpen,
  defaultParentBranchId,
  setDefaultParentBranchId,
  typeFilter,
  setTypeFilter,
  deleteOpen,
  setDeleteOpen,
  selected,
  setSelected,
  data,
  isLoading,
  columns,
  canCreate,
  handleSubmit,
  handleDelete,
  formLoading,
  deleteLoading,
  showEmptyBanner,
}: BranchesPageTemplateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef(false);

  const [docsBranch, setDocsBranch] = useState<Branch | null>(null);
  const [deeplinkDocumentId, setDeeplinkDocumentId] = useState<string | undefined>();

  function clearDeeplinkParams() {
    router.replace("/settings/branches");
    setDeeplinkDocumentId(undefined);
    deepLinkHandled.current = false;
  }

  useEffect(() => {
    const branchId = searchParams.get("branchId");
    const documentId = searchParams.get("documentId");
    if (!branchId || !documentId || deepLinkHandled.current) return;
    if (isLoading) return;

    const branch = data?.data?.find((b) => b._id === branchId);
    if (!branch) {
      toast.error("Branch not found");
      clearDeeplinkParams();
      return;
    }

    deepLinkHandled.current = true;
    setDeeplinkDocumentId(documentId);
    setDocsBranch(branch);
  }, [searchParams, data?.data, isLoading]);

  const extendedColumns = [
    ...columns.filter((c) => c.key !== "actions"),
    {
      key: "docs",
      header: "Documents",
      cell: (r: Branch) => (
        <button type="button" title="Branch Documents"
          onClick={() => setDocsBranch(r)}
          className="flex items-center gap-1 rounded-md border border-brand/30 bg-brand/5 px-2 py-1 text-xs text-brand hover:bg-brand/10">
          <FileText className="h-3.5 w-3.5" />Documents
        </button>
      ),
    },
    ...columns.filter((c) => c.key === "actions"),
  ];

  return (
    <div className={styles.root}>
      <PageHeader
        title="Branches"
        description="Manage main branches and sub-branches — each can have its own warehouse location, stock, and attendance zone."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Settings" }, { label: "Branches" }]}
        actions={
          canCreate ? (
            <Button onClick={() => { setSelected(null); setDefaultParentBranchId(""); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Add Branch
            </Button>
          ) : undefined
        }
      />

      {showEmptyBanner ? (
        <div className={styles.emptyBanner}>
          No branches yet. Create your first branch here, then go to{" "}
          <a href="/employees" className={styles.emptyLink}>Employees</a> to add staff.
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or code..." />
        </div>
        <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          options={[
            { value: "", label: "All types" },
            { value: "main", label: "Main branches" },
            { value: "sub", label: "Sub-branches" },
          ]}
          className="w-40" />
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={[{ value: "", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
          className="w-36" />
      </div>

      <DataTable
        columns={extendedColumns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyTitle="No branches found"
        emptyDescription="Add a branch to start managing employees."
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
      />

      <BranchFormModal
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setSelected(null);
            setDefaultParentBranchId("");
          }
        }}
        branch={selected}
        defaultParentBranchId={defaultParentBranchId}
        onSubmit={handleSubmit}
        loading={formLoading}
      />

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Branch"
        description={`Permanently delete "${selected?.name}"? All delivery zones and sub-branches under this branch will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />

      {/* Per-branch documents drawer */}
      {docsBranch ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-end bg-black/40">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
            <BranchDocumentsPanel
              branch={docsBranch}
              canEdit={canCreate}
              initialDocumentId={deeplinkDocumentId}
              onDeeplinkHandled={clearDeeplinkParams}
              onClose={() => {
                setDocsBranch(null);
                if (searchParams.get("branchId")) clearDeeplinkParams();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
