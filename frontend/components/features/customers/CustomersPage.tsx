"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { customerApi } from "@/lib/api/customers";
import { geocodeAddress } from "@/lib/geocoding-client";
import { formatPhoneDisplay, normalizePhone } from "@/lib/phone";
import { SaleDetailModal } from "@/components/features/orders/SaleDetailModal";
import type { Customer, CustomerCluster, CustomerDetail, Sale } from "@/types/customer";

const MapLocationPicker = dynamic(
  () => import("@/components/common/MapLocationPicker").then((m) => m.MapLocationPicker),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full rounded-lg" />,
  }
);

const emptyForm = {
  phone: "",
  email: "",
  name: "",
  address: "",
  area: "",
  notes: "",
  lat: "",
  lng: "",
};

function clusterLabel(clusterId: Customer["clusterId"]): string | null {
  if (!clusterId || typeof clusterId === "string") return null;
  const c = clusterId as CustomerCluster;
  return c.name ?? c.code ?? null;
}

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

export function CustomersPage() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [mapFocusKey, setMapFocusKey] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [saleDetailOpen, setSaleDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const companyId = user?.companyId ?? branches[0]?.companyId ?? "";

  const parsedLat = form.lat ? Number(form.lat) : null;
  const parsedLng = form.lng ? Number(form.lng) : null;

  function setLocation(lat: number, lng: number) {
    setForm((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }));
  }

  async function findAddressOnMap() {
    if (!form.address.trim()) {
      toast.error("Enter an address first");
      return;
    }
    setGeocoding(true);
    try {
      const coords = await geocodeAddress(form.address);
      if (!coords) {
        toast.error("Could not find that address on the map");
        return;
      }
      setLocation(coords.lat, coords.lng);
      setMapFocusKey((k) => k + 1);
      toast.success("Location pinned from address");
    } catch {
      toast.error("Geocoding failed — try clicking the map instead");
    } finally {
      setGeocoding(false);
    }
  }

  const coordinatesPayload =
    parsedLat != null && parsedLng != null && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)
      ? { lat: parsedLat, lng: parsedLng }
      : undefined;

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function afterSave(customer: Customer, verb: "added" | "updated") {
    const cluster = clusterLabel(customer.clusterId);
    toast.success(
      cluster
        ? `Customer ${verb} and assigned to cluster ${cluster}`
        : customer.coordinates
          ? `Customer ${verb} — location is outside all clusters`
          : `Customer ${verb}`
    );
    closeForm();
    void qc.invalidateQueries({ queryKey: ["customers"] });
    void qc.invalidateQueries({ queryKey: ["customer-stats"] });
  }

  const createMut = useMutation({
    mutationFn: () =>
      customerApi.create({
        companyId,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        name: form.name.trim() || undefined,
        address: form.address.trim() || undefined,
        area: form.area.trim() || undefined,
        coordinates: coordinatesPayload,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (customer) => afterSave(customer, "added"),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      customerApi.update(editingId!, {
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        name: form.name.trim() || undefined,
        address: form.address.trim() || undefined,
        area: form.area.trim() || undefined,
        coordinates: coordinatesPayload,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: (customer) => {
      afterSave(customer, "updated");
      void qc.invalidateQueries({ queryKey: ["customer", editingId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => customerApi.remove(id),
    onSuccess: () => {
      toast.success("Customer deleted");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saving = createMut.isPending || updateMut.isPending;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMapFocusKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditingId(customer._id);
    setForm({
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      name: customer.name ?? "",
      address: customer.address ?? "",
      area: customer.area ?? "",
      notes: customer.notes ?? "",
      lat: customer.coordinates?.lat != null ? String(customer.coordinates.lat) : "",
      lng: customer.coordinates?.lng != null ? String(customer.coordinates.lng) : "",
    });
    setMapFocusKey((k) => k + 1);
    setFormOpen(true);
  }

  function submitForm() {
    if (editingId) updateMut.mutate();
    else createMut.mutate();
  }

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, search],
    queryFn: () => customerApi.list({ page, limit: 20, search: search || undefined }),
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["customer-stats"],
    queryFn: () => customerApi.stats(),
    enabled: !!user,
  });

  const hasPin =
    parsedLat != null && parsedLng != null && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng);

  const { data: locationInfo, isFetching: resolvingLocation } = useQuery({
    queryKey: ["resolve-cluster", companyId, form.lat, form.lng],
    queryFn: () =>
      customerApi.resolveCluster({ companyId, lat: Number(form.lat), lng: Number(form.lng) }),
    enabled: formOpen && !!companyId && hasPin,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["customer", selectedId],
    queryFn: () => customerApi.get(selectedId!),
    enabled: !!selectedId && detailOpen,
  });

  const openDetail = (customer: Customer) => {
    setSelectedId(customer._id);
    setDetailOpen(true);
  };

  const openSaleDetail = (sale: Sale) => {
    setSelectedSaleId(sale._id);
    setSaleDetailOpen(true);
  };

  const columns: Column<Customer>[] = useMemo(
    () => [
      { key: "name", header: "Customer", cell: (r) => <span className="font-medium">{r.name || "—"}</span> },
      { key: "phone", header: "Phone", cell: (r) => formatPhoneDisplay(r.phone) },
      { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
      { key: "area", header: "Area", cell: (r) => r.area ?? "—" },
      {
        key: "cluster",
        header: "Cluster",
        cell: (r) => {
          const label = clusterLabel(r.clusterId);
          if (label) {
            return (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                {label}
              </span>
            );
          }
          if (r.coordinates) {
            return (
              <div className="flex flex-col gap-1">
                <span className="inline-flex w-fit items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                  Outside clusters
                </span>
                {r.address ? (
                  <span className="max-w-[220px] truncate text-xs text-muted-foreground" title={r.address}>
                    {r.address}
                  </span>
                ) : null}
              </div>
            );
          }
          return <span className="text-xs text-muted-foreground">No location</span>;
        },
      },
      { key: "purchases", header: "Purchases", cell: (r) => r.totalPurchases ?? 0 },
      { key: "spent", header: "Total Spent", cell: (r) => formatAmount(r.totalSpent) },
      { key: "last", header: "Last Purchase", cell: (r) => formatDate(r.lastPurchaseAt) },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => openDetail(r)} aria-label="View customer">
              <Eye className="h-4 w-4" />
            </Button>
            {can("customer:edit") ? (
              <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Edit customer">
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            {can("customer:delete") ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(r)}
                aria-label="Delete customer"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can]
  );

  const saleColumns: Column<Sale>[] = useMemo(
    () => [
      { key: "saleNumber", header: "Sale #", cell: (r) => r.saleNumber },
      { key: "product", header: "Product", cell: (r) => refName(r.productId) },
      {
        key: "sku",
        header: "SKU",
        cell: (r) => (typeof r.productId === "object" ? r.productId.sku : "—"),
      },
      { key: "branch", header: "Branch", cell: (r) => refName(r.branchId) },
      { key: "qty", header: "Qty", cell: (r) => r.quantity },
      { key: "total", header: "Total", cell: (r) => formatAmount(r.totalAmount) },
      { key: "date", header: "Date", cell: (r) => formatDate(r.createdAt) },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <Button variant="ghost" size="icon" onClick={() => openSaleDetail(r)} aria-label="View sale">
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const customer = detail as CustomerDetail | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer profiles and purchase history from inventory sales"
        actions={
          can("customer:create") ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total customers</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats?.total ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">In a cluster</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats?.inCluster ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Outside clusters</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{stats?.outsideClusters ?? 0}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Pinned, but no cluster covers them — expansion candidates</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">No location set</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats?.noLocation ?? 0}</p>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone, or email..." className="max-w-xs" />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
      />

      <Modal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedId(null);
        }}
        title="Customer Details"
        size="lg"
      >
        {detailLoading || !customer ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{customer.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{formatPhoneDisplay(customer.phone)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium">{customer.address || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Area</p>
                <p className="font-medium">{customer.area || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivery cluster</p>
                <p className="font-medium">
                  {clusterLabel(customer.clusterId) ??
                    (customer.coordinates ? "Outside all clusters" : "No location set")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{customer.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="font-medium">{formatAmount(customer.totalSpent)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="font-medium">{customer.totalPurchases ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Purchase</p>
                <p className="font-medium">{formatDate(customer.lastPurchaseAt)}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Purchase History</h3>
              <p className="mb-2 text-xs text-muted-foreground">Click the eye icon on an order to view full details.</p>
              <DataTable columns={saleColumns} data={customer.sales ?? []} loading={false} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
          else setFormOpen(true);
        }}
        title={editingId ? "Edit Customer" : "Add Customer"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Label>Phone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 91234567"
            />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <Label className="mb-0">Delivery address</Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void findAddressOnMap()}
                disabled={geocoding || !form.address.trim()}
                loading={geocoding}
              >
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                Find on map
              </Button>
            </div>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Al Khuwair, Muscat"
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Click the map to pin the customer, or drag the marker. We fetch the coordinates and auto-assign the
              matching delivery cluster.
            </p>
            <MapLocationPicker lat={parsedLat} lng={parsedLng} onChange={setLocation} focusKey={mapFocusKey} />
            {hasPin ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Pinned at {parsedLat!.toFixed(5)}, {parsedLng!.toFixed(5)}
              </p>
            ) : null}
            {hasPin ? (
              <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                {resolvingLocation ? (
                  <p className="text-xs text-muted-foreground">Locating branch & cluster…</p>
                ) : locationInfo?.cluster ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Branch</span>
                      <span className="font-medium text-foreground">
                        {locationInfo.branch?.name ?? "—"}
                        {locationInfo.branch?.code ? ` (${locationInfo.branch.code})` : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Cluster</span>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        {locationInfo.cluster.name ?? locationInfo.cluster.code}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">
                    This location is outside all delivery clusters. The customer will be saved without a cluster —
                    consider expanding a cluster to cover this area.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <div>
            <Label>Area / zone</Label>
            <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={closeForm}>
            Cancel
          </Button>
          <Button disabled={!normalizePhone(form.phone) || saving} loading={saving} onClick={submitForm}>
            {editingId ? "Save Changes" : "Save Customer"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Customer"
        size="sm"
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-medium text-foreground">
            {deleteTarget?.name || formatPhoneDisplay(deleteTarget?.phone ?? "")}
          </span>
          ? This removes the customer from the list. Purchase history is preserved.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMut.isPending}
            loading={deleteMut.isPending}
            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget._id)}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <SaleDetailModal
        saleId={selectedSaleId}
        open={saleDetailOpen}
        onOpenChange={(open) => {
          setSaleDetailOpen(open);
          if (!open) setSelectedSaleId(null);
        }}
      />
    </div>
  );
}
