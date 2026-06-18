"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { usePermissions } from "@/hooks/usePermissions";
import { companyApi, type Company } from "@/lib/api/companies";
import { businessDocApi } from "@/lib/api/businessDocuments";
import { getAccessToken } from "@/lib/api/token";
import type { BusinessDocument } from "@/types/documents";

// ─── helpers ──────────────────────────────────────────────────────────────────

const BIZ_TYPES = [
  { value: "cr_certificate", label: "CR Certificate" },
  { value: "chamber_of_commerce", label: "Chamber of Commerce" },
  { value: "custom", label: "Custom Document" },
];

const BIZ_DOC_LABELS: Record<string, string> = {
  cr_certificate: "CR Certificate",
  chamber_of_commerce: "Chamber of Commerce",
  custom: "Custom Document",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function daysLeft(expiry?: string): { label: string; cls: string } | null {
  if (!expiry) return null;
  const d = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return { label: "Expired", cls: "text-destructive font-semibold" };
  if (d <= 15) return { label: `${d}d left`, cls: "text-destructive font-semibold" };
  if (d <= 45) return { label: `${d}d left`, cls: "text-amber-600 font-semibold" };
  return { label: `${d}d left`, cls: "text-emerald-600" };
}

// ─── Inline document viewer ────────────────────────────────────────────────────

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

// ─── File upload field (reusable within this file) ────────────────────────────

function FileUploadField({
  file,
  existingUrl,
  existingName,
  onFileChange,
  onViewExisting,
}: {
  file: File | null;
  existingUrl?: string;
  existingName?: string;
  onFileChange: (f: File | null) => void;
  onViewExisting?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      {/* Existing file row */}
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

      {/* Drop zone / picker */}
      {!existingUrl || file ? (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
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
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onFileChange(null); } }}
              className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10"
            >
              Remove
            </span>
          ) : null}
        </button>
      ) : null}

      <input
        ref={ref}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => { onFileChange(e.target.files?.[0] ?? null); e.target.value = ""; }}
      />
    </div>
  );
}

// ─── Business Documents panel (per company) ───────────────────────────────────

const emptyBizForm = { type: "cr_certificate", customTypeName: "", startDate: "", expiryDate: "", notes: "" };

function BusinessDocumentsPanel({ companyId, companyName, canEdit, onClose }: {
  companyId: string;
  companyName: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessDocument | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState(emptyBizForm);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["business-docs", companyId],
    queryFn: () => businessDocApi.list({ companyId }),
  });

  function closeForm() {
    setFormOpen(false);
    setSelected(null);
    setForm(emptyBizForm);
    setDocFile(null);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        companyId,
        customTypeName: form.type === "custom" ? form.customTypeName : undefined,
      };
      const saved = selected
        ? await businessDocApi.update(selected._id, payload)
        : await businessDocApi.create(payload);

      if (docFile) {
        const fd = new FormData();
        fd.append("file", docFile);
        await businessDocApi.uploadFile(saved._id, fd);
      }
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-docs", companyId] });
      toast.success(selected ? "Document updated" : "Document added");
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => businessDocApi.delete(selected!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-docs", companyId] });
      toast.success("Document deleted");
      setDeleteOpen(false);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(doc: BusinessDocument) {
    setSelected(doc);
    setForm({
      type: doc.type,
      customTypeName: doc.customTypeName ?? "",
      startDate: doc.startDate?.slice(0, 10) ?? "",
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

  return (
    <>
      {viewerUrl ? <DocViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} /> : null}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold">Business Documents</h2>
          <p className="text-sm text-muted-foreground">{companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button onClick={() => { setSelected(null); setForm(emptyBizForm); setDocFile(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Add Document
            </Button>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">✕</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No documents yet for this company.</p>
            <p className="text-xs text-muted-foreground">Add CR Certificate, Chamber of Commerce, or any compliance document.</p>
            {canEdit ? (
              <Button className="mt-2" onClick={() => { setSelected(null); setForm(emptyBizForm); setDocFile(null); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />Add First Document
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const expiry = daysLeft(doc.expiryDate);
              const docLabel = doc.type === "custom" ? (doc.customTypeName ?? "Custom") : BIZ_DOC_LABELS[doc.type];
              return (
                <div key={doc._id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="font-medium text-sm">{docLabel}</p>
                      <StatusBadge status={doc.status} />
                      {doc.fileUrl ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">
                          File attached
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 border border-amber-200">
                          No file
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-6 text-xs text-muted-foreground">
                      {doc.startDate ? <span>Start: {fmtDate(doc.startDate)}</span> : null}
                      {doc.expiryDate ? (
                        <span className={expiry?.cls ?? ""}>Expires: {fmtDate(doc.expiryDate)}{expiry ? ` · ${expiry.label}` : ""}</span>
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

      {/* Add/Edit modal */}
      <Modal
        open={formOpen}
        onOpenChange={(o) => { if (!o) closeForm(); else setFormOpen(true); }}
        title={selected ? "Edit Business Document" : "Add Business Document"}
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
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={BIZ_TYPES} />
          </div>

          {form.type === "custom" ? (
            <div>
              <Label>Custom Type Name *</Label>
              <Input value={form.customTypeName} onChange={(e) => setForm({ ...form, customTypeName: e.target.value })} placeholder="e.g. Trade License" />
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
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <Label>Document File</Label>
            <div className="mt-1">
              <FileUploadField
                file={docFile}
                existingUrl={selected?.fileUrl}
                existingName={selected?.fileUrl?.split("/").pop()}
                onFileChange={setDocFile}
                onViewExisting={selected?.fileUrl ? () => openViewer(selected.fileUrl!, BIZ_DOC_LABELS[selected.type] ?? selected.customTypeName ?? "Document") : undefined}
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Document"
        description={`Permanently delete "${selected?.type === "custom" ? selected?.customTypeName : BIZ_DOC_LABELS[selected?.type ?? ""] ?? "this document"}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        zIndex={70}
      />
    </>
  );
}

// ─── Company form ──────────────────────────────────────────────────────────────

const emptyCompanyForm = { name: "", code: "", email: "", phone: "", address: "" };

// ─── Main page ────────────────────────────────────────────────────────────────

export function CompanySetupPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyCompanyForm);
  const [docsCompany, setDocsCompany] = useState<Company | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyApi.getAll(),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      selected ? companyApi.update(selected._id, form) : companyApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success(selected ? "Company updated" : "Company created");
      setFormOpen(false); setSelected(null); setForm(emptyCompanyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => companyApi.delete(selected!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company deleted");
      setDeleteOpen(false); setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(company: Company) {
    setSelected(company);
    setForm({ name: company.name, code: company.code, email: company.email ?? "", phone: company.phone ?? "", address: company.address ?? "" });
    setFormOpen(true);
  }

  const canEdit = can("company:edit");
  const canDelete = can("company:delete");

  const columns: Column<Company>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
    { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <button type="button" title="Business Documents" onClick={() => setDocsCompany(r)}
            className="flex items-center gap-1 rounded-md border border-brand/30 bg-brand/5 px-2 py-1 text-xs text-brand hover:bg-brand/10">
            <FileText className="h-3.5 w-3.5" />Documents
          </button>
          {canEdit ? (
            <button type="button" title="Edit" onClick={() => openEdit(r)}
              className="rounded-md border border-border p-1.5 hover:bg-muted">
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" title="Delete" onClick={() => { setSelected(r); setDeleteOpen(true); }}
              className="rounded-md border border-border p-1.5 text-destructive hover:bg-muted">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Company Settings"
        description="Manage companies and their business compliance documents."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Settings" }, { label: "Company" }]}
        actions={
          can("company:create") ? (
            <Button onClick={() => { setSelected(null); setForm(emptyCompanyForm); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Add Company
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyTitle="No companies"
        emptyDescription="Create your first company, then add branches and employees."
      />

      {/* Add / Edit company modal */}
      <Modal
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) { setSelected(null); setForm(emptyCompanyForm); } }}
        title={selected ? "Edit Company" : "Add Company"}
        footer={
          <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()} disabled={!form.name || !form.code}>
            {selected ? "Save Changes" : "Create Company"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="NOOR Trading LLC" />
          </div>
          <div>
            <Label>Company Code *</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="NOOR01" disabled={!!selected} />
            {selected ? <p className="mt-1 text-xs text-muted-foreground">Code cannot be changed after creation.</p> : null}
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Company"
        description={`Permanently delete "${selected?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />

      {/* Per-company documents drawer */}
      {docsCompany ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-end bg-black/40">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
            <BusinessDocumentsPanel
              companyId={docsCompany._id}
              companyName={docsCompany.name}
              canEdit={canEdit}
              onClose={() => setDocsCompany(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
