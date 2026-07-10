"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { supplierApi } from "@/lib/api/suppliers";
import { PurchaseOrderDetailModal } from "@/components/features/orders/PurchaseOrderDetailModal";
import type { PurchaseOrder } from "@/types/purchase";
import type { Supplier, SupplierDetail } from "@/types/supplier";

const emptyForm = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  country: "OM",
  paymentTerms: "",
  deliveryLeadTimeDays: "",
  rating: "",
  notes: "",
  status: "active",
};

function refName(ref: string | { name?: string; sku?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.sku ?? "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatAmount(value?: number) {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(3)} OMR`;
}

export function SuppliersPage() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [purchaseDetailOpen, setPurchaseDetailOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const companyId = user?.companyId ?? branches[0]?.companyId ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", page, search],
    queryFn: () => supplierApi.list({ page, limit: 20, search: search || undefined }),
    enabled: !!user,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["supplier", selectedId],
    queryFn: () => supplierApi.get(selectedId!),
    enabled: !!selectedId && detailOpen,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!selected && !companyId) {
        throw new Error("No company linked to your account. Log out and back in, or select a branch.");
      }
      const payload = {
        ...(companyId ? { companyId } : {}),
        name: form.name,
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        country: form.country || undefined,
        paymentTerms: form.paymentTerms || undefined,
        deliveryLeadTimeDays: form.deliveryLeadTimeDays ? Number(form.deliveryLeadTimeDays) : undefined,
        rating: form.rating ? Number(form.rating) : undefined,
        notes: form.notes || undefined,
        status: form.status as Supplier["status"],
      };
      return selected ? supplierApi.update(selected._id, payload) : supplierApi.create(payload);
    },
    onSuccess: () => {
      toast.success(selected ? "Supplier updated" : "Supplier created");
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => supplierApi.remove(selected!._id),
    onSuccess: () => {
      toast.success("Supplier archived");
      setDeleteOpen(false);
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDetail = (supplier: Supplier) => {
    setSelectedId(supplier._id);
    setDetailOpen(true);
  };

  const openPurchaseDetail = (po: PurchaseOrder) => {
    setSelectedPurchaseId(po._id);
    setPurchaseDetailOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setSelected(s);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      country: s.country ?? "OM",
      paymentTerms: s.paymentTerms ?? "",
      deliveryLeadTimeDays: s.deliveryLeadTimeDays?.toString() ?? "",
      rating: s.rating?.toString() ?? "",
      notes: s.notes ?? "",
      status: s.status,
    });
    setFormOpen(true);
  };

  const columns: Column<Supplier>[] = useMemo(
    () => [
      { key: "name", header: "Supplier", cell: (r) => <span className="font-medium">{r.name}</span> },
      { key: "contact", header: "Contact", cell: (r) => r.contactPerson ?? "—" },
      { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
      { key: "orders", header: "Orders", cell: (r) => r.totalOrders ?? 0 },
      { key: "spent", header: "Total Purchased", cell: (r) => formatAmount(r.totalSpent) },
      { key: "last", header: "Last Order", cell: (r) => formatDate(r.lastOrderAt) },
      { key: "rating", header: "Rating", cell: (r) => (r.rating ? `${r.rating}/5` : "—") },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => openDetail(r)} aria-label="View supplier">
              <Eye className="h-4 w-4" />
            </Button>
            {can("supplier:edit") ? <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button> : null}
            {can("supplier:delete") ? <Button variant="ghost" size="icon" onClick={() => { setSelected(r); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button> : null}
          </div>
        ),
      },
    ],
    [can]
  );

  const purchaseColumns: Column<PurchaseOrder>[] = useMemo(
    () => [
      { key: "po", header: "PO #", cell: (r) => <span className="font-mono text-sm">{r.poNumber}</span> },
      { key: "branch", header: "Branch", cell: (r) => refName(r.branchId) },
      { key: "items", header: "Items", cell: (r) => r.items.length },
      { key: "total", header: "Total", cell: (r) => formatAmount(r.totalAmount) },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      { key: "date", header: "Date", cell: (r) => formatDate(r.createdAt) },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <Button variant="ghost" size="icon" onClick={() => openPurchaseDetail(r)} aria-label="View purchase order">
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const supplier = detail as SupplierDetail | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage supplier profiles, payment terms, and purchase history"
        actions={
          can("supplier:create") ? (
            <Button onClick={() => { setSelected(null); setForm(emptyForm); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          ) : null
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search suppliers..." className="max-w-xs" />
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} />

      <Modal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedId(null);
        }}
        title="Supplier Details"
        size="lg"
      >
        {detailLoading || !supplier ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{supplier.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contact Person</p>
                <p className="font-medium">{supplier.contactPerson || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{supplier.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{supplier.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Terms</p>
                <p className="font-medium">{supplier.paymentTerms || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lead Time</p>
                <p className="font-medium">
                  {supplier.deliveryLeadTimeDays ? `${supplier.deliveryLeadTimeDays} days` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="font-medium">{supplier.totalOrders ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Purchased</p>
                <p className="font-medium">{formatAmount(supplier.totalSpent)}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Purchase Order History</h3>
              <p className="mb-2 text-xs text-muted-foreground">Click the eye icon on an order to view full details.</p>
              <DataTable columns={purchaseColumns} data={supplier.purchaseOrders ?? []} loading={false} />
            </div>
          </div>
        )}
      </Modal>

      <PurchaseOrderDetailModal
        purchaseId={selectedPurchaseId}
        open={purchaseDetailOpen}
        onOpenChange={(open) => {
          setPurchaseDetailOpen(open);
          if (!open) setSelectedPurchaseId(null);
        }}
      />

      <Modal open={formOpen} onOpenChange={setFormOpen} title={selected ? "Edit Supplier" : "Add Supplier"} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g. Net 30" /></div>
          <div><Label>Lead Time (days)</Label><Input type="number" value={form.deliveryLeadTimeDays} onChange={(e) => setForm({ ...form, deliveryLeadTimeDays: e.target.value })} /></div>
          <div><Label>Rating (1-5)</Label><Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
          <div><Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "blacklisted", label: "Blacklisted" },
              ]}
            />
          </div>
          <div className="sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            disabled={!form.name || saveMut.isPending || (!selected && !companyId)}
            onClick={() => saveMut.mutate()}
          >
            Save
          </Button>
        </div>
      </Modal>

      <ConfirmationModal open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={() => deleteMut.mutate()} title="Archive Supplier" description={`Archive "${selected?.name}"?`} confirmLabel="Archive" variant="danger" loading={deleteMut.isPending} />
    </div>
  );
}
