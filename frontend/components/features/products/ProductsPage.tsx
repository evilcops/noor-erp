"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { FileUpload } from "@/components/common/FileUpload";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { BranchSubBranchSelect } from "@/components/common/BranchSubBranchSelect";
import { Select } from "@/components/ui/Select";
import { resolveMainAndSubBranchId } from "@/lib/branch-utils";
import { ProductImage } from "@/components/features/products/ProductImage";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { productApi } from "@/lib/api/products";
import { supplierApi } from "@/lib/api/suppliers";
import type { Product } from "@/types/inventory";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "discontinued", label: "Discontinued" },
  { value: "out_of_stock", label: "Out of Stock" },
];

const emptyForm = {
  name: "",
  category: "",
  subCategory: "",
  brand: "",
  supplierId: "",
  description: "",
  purchaseCost: "",
  sellingPrice: "",
  unitOfMeasure: "pcs",
  minStockLevel: "0",
  reorderLevel: "0",
  status: "active",
  sku: "",
  initialQty: "",
};

export function ProductsPage() {
  const { user } = useAuth();
  const { branches, activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [branchId, setBranchId] = useState(activeBranchId ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formImages, setFormImages] = useState<string[]>([]);

  const companyId = user?.companyId ?? branches[0]?.companyId ?? "";

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const resetImageState = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormImages([]);
  };

  const buildPayload = () => ({
    companyId,
    name: form.name,
    sku: form.sku || undefined,
    category: form.category || undefined,
    subCategory: form.subCategory || undefined,
    brand: form.brand || undefined,
    supplierId: form.supplierId || undefined,
    description: form.description || undefined,
    purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
    sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : undefined,
    unitOfMeasure: form.unitOfMeasure,
    minStockLevel: Number(form.minStockLevel) || 0,
    reorderLevel: Number(form.reorderLevel) || 0,
    status: form.status as Product["status"],
    initialStock:
      branchId && form.initialQty
        ? { branchId, quantity: Number(form.initialQty) }
        : undefined,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["products", page, search, statusFilter],
    queryFn: () => productApi.list({ page, limit: 20, search: search || undefined, status: statusFilter || undefined }),
    enabled: !!user,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: () => supplierApi.list({ limit: 100, status: "active" }),
    enabled: !!user && formOpen,
  });

  const suppliers = suppliersData?.data ?? [];
  const products = data?.data ?? [];

  const createMut = useMutation({
    mutationFn: async () => {
      const product = await productApi.create(buildPayload());
      if (imageFile) {
        await productApi.uploadImage(product._id, imageFile);
      }
      return product;
    },
    onSuccess: () => {
      toast.success("Product created");
      setFormOpen(false);
      setForm(emptyForm);
      resetImageState();
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const product = await productApi.update(selected!._id, {
        name: form.name,
        sku: form.sku || undefined,
        category: form.category || undefined,
        subCategory: form.subCategory || undefined,
        brand: form.brand || undefined,
        supplierId: form.supplierId || undefined,
        description: form.description || undefined,
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : undefined,
        unitOfMeasure: form.unitOfMeasure,
        minStockLevel: Number(form.minStockLevel) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        status: form.status as Product["status"],
      });
      if (imageFile) {
        await productApi.uploadImage(product._id, imageFile);
      }
      return product;
    },
    onSuccess: () => {
      toast.success("Product updated");
      setFormOpen(false);
      resetImageState();
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeImageMut = useMutation({
    mutationFn: ({ productId, imageIndex }: { productId: string; imageIndex: number }) =>
      productApi.removeImage(productId, imageIndex),
    onSuccess: (product) => {
      setFormImages(product.images ?? []);
      if (selected) setSelected({ ...selected, images: product.images ?? [] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Image removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => productApi.remove(selected!._id),
    onSuccess: () => {
      toast.success("Product archived");
      setDeleteOpen(false);
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (p: Product) => {
    setSelected(p);
    setFormImages(p.images ?? []);
    setImageFile(null);
    setForm({
      name: p.name,
      category: p.category ?? "",
      subCategory: p.subCategory ?? "",
      brand: p.brand ?? "",
      supplierId: typeof p.supplierId === "object" ? p.supplierId?._id ?? "" : p.supplierId ?? "",
      description: p.description ?? "",
      purchaseCost: p.purchaseCost?.toString() ?? "",
      sellingPrice: p.sellingPrice?.toString() ?? "",
      unitOfMeasure: p.unitOfMeasure,
      minStockLevel: String(p.minStockLevel),
      reorderLevel: String(p.reorderLevel),
      status: p.status,
      sku: p.sku,
      initialQty: "",
    });
    setFormOpen(true);
  };

  const openDetail = async (p: Product) => {
    const full = await productApi.get(p._id);
    setSelected(full);
    setDetailOpen(true);
  };

  const columns: Column<Product>[] = useMemo(
    () => [
      {
        key: "image",
        header: "",
        cell: (r) => <ProductImage src={r.images?.[0]} alt={r.name} size="sm" />,
      },
      { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
      { key: "name", header: "Product", cell: (r) => <span className="font-medium">{r.name}</span> },
      { key: "category", header: "Category", cell: (r) => r.category ?? "—" },
      { key: "brand", header: "Brand", cell: (r) => r.brand ?? "—" },
      {
        key: "status",
        header: "Status",
        cell: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => void openDetail(r)}><Eye className="h-4 w-4" /></Button>
            {can("product:edit") ? (
              <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
            ) : null}
            {can("product:delete") ? (
              <Button variant="ghost" size="icon" onClick={() => { setSelected(r); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
            ) : null}
          </div>
        ),
      },
    ],
    [can]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Product catalogue with SKU, barcode, and QR codes"
        actions={
          can("product:create") ? (
            <Button onClick={() => { setSelected(null); setForm(emptyForm); resetImageState(); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." className="max-w-xs" />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
          options={[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS]}
        />
      </div>

      <DataTable columns={columns} data={products} loading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} />

      <Modal open={formOpen} onOpenChange={setFormOpen} title={selected ? "Edit Product" : "Add Product"} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Auto-generated if empty" /></div>
          <div><Label>Unit</Label><Input value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} /></div>
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div><Label>Sub-category</Label><Input value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} /></div>
          <div><Label>Brand</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
          <div>
            <Label>Supplier</Label>
            <Select
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              options={[{ value: "", label: "None" }, ...suppliers.map((s) => ({ value: s._id, label: s.name }))]}
            />
          </div>
          <div><Label>Purchase Cost (OMR)</Label><Input type="number" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} /></div>
          <div><Label>Selling Price (OMR)</Label><Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
          <div><Label>Min Stock</Label><Input type="number" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })} /></div>
          <div><Label>Reorder Level</Label><Input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
          {!selected ? (
            <>
              <div className="sm:col-span-2">
                <Label>Initial Branch</Label>
                <BranchSubBranchSelect
                  branches={branches}
                  mainBranchId={resolveMainAndSubBranchId(branchId, branches).mainId}
                  subBranchId={resolveMainAndSubBranchId(branchId, branches).subId}
                  onMainBranchChange={(id) => setBranchId(id)}
                  onSubBranchChange={(id) => {
                    const mainId = resolveMainAndSubBranchId(branchId, branches).mainId;
                    setBranchId(id || mainId);
                  }}
                />
              </div>
              <div><Label>Initial Qty</Label><Input type="number" value={form.initialQty} onChange={(e) => setForm({ ...form, initialQty: e.target.value })} /></div>
            </>
          ) : null}
          <div className="sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

          <div className="sm:col-span-2 space-y-3">
            <Label>Product Image</Label>
            {(formImages.length > 0 || imagePreview) ? (
              <div className="flex flex-wrap gap-3">
                {formImages.map((url, idx) => (
                  <div key={url} className="relative">
                    <ProductImage src={url} alt={form.name || "Product"} size="md" />
                    {can("product:edit") && selected ? (
                      <button
                        type="button"
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow"
                        onClick={() => removeImageMut.mutate({ productId: selected._id, imageIndex: idx })}
                        aria-label="Remove image"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg border border-brand object-cover" />
                    <button
                      type="button"
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground shadow"
                      onClick={() => setImageFile(null)}
                      aria-label="Clear preview"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {can("product:edit") || can("product:create") ? (
              (formImages.length + (imageFile ? 1 : 0)) < 5 ? (
                <FileUpload
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  label="Upload product image (JPG, PNG, WEBP, GIF)"
                  onFileSelect={(file) => {
                    if (!file.type.startsWith("image/")) {
                      toast.error("Please select an image file");
                      return;
                    }
                    setImageFile(file);
                  }}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Maximum 5 images per product</p>
              )
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            disabled={!form.name || createMut.isPending || updateMut.isPending}
            onClick={() => (selected ? updateMut.mutate() : createMut.mutate())}
          >
            {selected ? "Save" : "Create"}
          </Button>
        </div>
      </Modal>

      <Modal open={detailOpen} onOpenChange={setDetailOpen} title="Product Profile" size="lg">
        {selected ? (
          <div className="space-y-4 text-sm">
            {selected.images?.length ? (
              <div className="flex flex-wrap gap-3">
                {selected.images.map((url) => (
                  <ProductImage key={url} src={url} alt={selected.name} size="lg" className="max-h-40" />
                ))}
              </div>
            ) : (
              <ProductImage alt={selected.name} size="lg" />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-muted-foreground">SKU</p><p className="font-mono font-medium">{selected.sku}</p></div>
              <div><p className="text-muted-foreground">Barcode</p><p className="font-mono">{selected.barcode ?? "—"}</p></div>
              <div><p className="text-muted-foreground">Code</p><p>{selected.code}</p></div>
              <div><p className="text-muted-foreground">Status</p><StatusBadge status={selected.status} /></div>
              <div className="sm:col-span-2"><p className="text-muted-foreground">QR Data</p><p className="break-all font-mono text-xs">{selected.qrCodeData ?? "—"}</p></div>
            </div>
            {selected.stockLevels?.length ? (
              <div>
                <p className="mb-2 font-medium">Branch Stock</p>
                <div className="space-y-1">
                  {selected.stockLevels.map((s) => (
                    <div key={s._id} className="flex justify-between rounded border px-3 py-2">
                      <span>{typeof s.branchId === "object" ? s.branchId?.name : "Branch"}</span>
                      <span className="font-semibold">{s.currentStock}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmationModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMut.mutate()}
        title="Archive Product"
        description={`Archive "${selected?.name}"?`}
        confirmLabel="Archive"
        variant="danger"
        loading={deleteMut.isPending}
      />
    </div>
  );
}
