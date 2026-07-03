"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { purchaseApi } from "@/lib/api/purchases";
import { supplierApi } from "@/lib/api/suppliers";
import { productApi } from "@/lib/api/products";
import { PurchasePipeline } from "@/components/features/purchases/PurchasePipeline";
import { ReceiptActions } from "@/components/features/orders/ReceiptActions";
import type { PurchaseOrder } from "@/types/purchase";

function refName(ref: string | { name?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? "—";
}

export function PurchasesPage() {
  const { user } = useAuth();
  const { branches, activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const restockHandled = useRef(false);
  const canCreatePurchase = can("purchase:create");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId ?? "");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [items, setItems] = useState<{ productId: string; quantityOrdered: number; unitCost: number }[]>([]);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});

  const companyId = user?.companyId ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["purchases", page, statusFilter],
    queryFn: () => purchaseApi.list({ page, limit: 20, status: statusFilter || undefined }),
    enabled: !!user,
  });

  const { data: pipelineData } = useQuery({
    queryKey: ["purchases-pipeline"],
    queryFn: () => purchaseApi.list({ page: 1, limit: 500 }),
    enabled: !!user,
  });

  const purchaseByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeStatuses = new Set([
      "draft",
      "requested",
      "approved",
      "ordered",
      "in_transit",
      "partially_received",
      "received",
    ]);
    for (const po of pipelineData?.data ?? []) {
      if (!activeStatuses.has(po.status)) continue;
      counts[po.status] = (counts[po.status] ?? 0) + 1;
    }
    return counts;
  }, [pipelineData?.data]);

  const recentPurchaseOrders = useMemo(
    () =>
      (pipelineData?.data ?? [])
        .filter((po) =>
          ["draft", "requested", "approved", "ordered", "in_transit", "partially_received", "received"].includes(
            po.status
          )
        )
        .slice(0, 5),
    [pipelineData?.data]
  );

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-active"],
    queryFn: () => supplierApi.list({ limit: 100, status: "active" }),
    enabled: !!user,
  });

  const { data: productsData } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => productApi.list({ limit: 100, status: "active" }),
    enabled: !!user,
  });

  useEffect(() => {
    if (restockHandled.current) return;
    const productIdParam = searchParams.get("productId");
    const branchIdParam = searchParams.get("branchId");
    const qtyParam = searchParams.get("qty");
    const isRestock = searchParams.get("restock") === "1";
    if (!isRestock || !productIdParam) return;

    if (branchIdParam) setBranchId(branchIdParam);
    setProductId(productIdParam);
    if (qtyParam) setQty(qtyParam);

    const product = (productsData?.data ?? []).find((p) => p._id === productIdParam);
    if (product?.purchaseCost) setUnitCost(String(product.purchaseCost));
    if (product && qtyParam) {
      setItems([
        {
          productId: productIdParam,
          quantityOrdered: Number(qtyParam) || 1,
          unitCost: product.purchaseCost ?? 0,
        },
      ]);
    }

    if (canCreatePurchase) {
      setFormOpen(true);
      restockHandled.current = true;
    }
  }, [searchParams, productsData?.data, canCreatePurchase]);

  const createMut = useMutation({
    mutationFn: () => purchaseApi.create({ companyId, branchId, supplierId, items }),
    onSuccess: async (created) => {
      toast.success("Purchase order created");
      setFormOpen(false);
      setItems([]);
      const full = await purchaseApi.get(created._id);
      setSelected(full);
      setDetailOpen(true);
      void qc.invalidateQueries({ queryKey: ["purchases"] });
      void qc.invalidateQueries({ queryKey: ["purchases-pipeline"] });
      void qc.invalidateQueries({ queryKey: ["inventory-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionMut = useMutation({
    mutationFn: async (action: string) => {
      if (!selected) return;
      if (action === "submit") return purchaseApi.submit(selected._id);
      if (action === "approve") return purchaseApi.approve(selected._id);
      if (action === "order") return purchaseApi.order(selected._id);
      if (action === "in_transit") return purchaseApi.markInTransit(selected._id);
      if (action === "receive") {
        const receiveItems = selected.items.map((i) => ({
          productId: typeof i.productId === "object" ? i.productId._id : i.productId,
          quantityReceived: Number(receiveQtys[typeof i.productId === "object" ? i.productId._id : i.productId] ?? 0),
        })).filter((i) => i.quantityReceived > 0);
        return purchaseApi.receive(selected._id, receiveItems);
      }
      if (action === "cancel") return purchaseApi.cancel(selected._id);
    },
    onSuccess: async (_, action) => {
      toast.success(action === "order" ? "Purchase order placed — receipt ready" : "Purchase order updated");
      if (selected) {
        const updated = await purchaseApi.get(selected._id);
        setSelected(updated);
      }
      void qc.invalidateQueries({ queryKey: ["purchases"] });
      void qc.invalidateQueries({ queryKey: ["purchases-pipeline"] });
      void qc.invalidateQueries({ queryKey: ["inventory-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["stock-levels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDetail = async (po: PurchaseOrder) => {
    const full = await purchaseApi.get(po._id);
    setSelected(full);
    const qtys: Record<string, string> = {};
    full.items.forEach((i) => {
      const id = typeof i.productId === "object" ? i.productId._id : i.productId;
      const remaining = i.quantityOrdered - i.quantityReceived;
      qtys[id] = String(remaining);
    });
    setReceiveQtys(qtys);
    setDetailOpen(true);
  };

  const addItem = () => {
    if (!productId || !qty || !unitCost) return;
    setItems([...items, { productId, quantityOrdered: Number(qty), unitCost: Number(unitCost) }]);
    setProductId("");
    setQty("1");
    setUnitCost("");
  };

  const columns: Column<PurchaseOrder>[] = useMemo(
    () => [
      { key: "po", header: "PO #", cell: (r) => <span className="font-mono text-sm">{r.poNumber}</span> },
      { key: "supplier", header: "Supplier", cell: (r) => refName(r.supplierId) },
      { key: "branch", header: "Branch", cell: (r) => refName(r.branchId) },
      { key: "total", header: "Total (OMR)", cell: (r) => r.totalAmount.toFixed(3) },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <Button variant="ghost" size="icon" onClick={() => void openDetail(r)}><Eye className="h-4 w-4" /></Button>
        ),
      },
    ],
    []
  );

  const workflowActions: Record<string, { label: string; action: string; permission: string }[]> = {
    draft: [{ label: "Submit for Approval", action: "submit", permission: "purchase:edit" }],
    requested: [{ label: "Approve", action: "approve", permission: "purchase:approve" }],
    approved: [{ label: "Mark Ordered", action: "order", permission: "purchase:edit" }],
    ordered: [{ label: "Mark In Transit", action: "in_transit", permission: "purchase:edit" }],
    in_transit: [{ label: "Receive Goods", action: "receive", permission: "purchase:edit" }],
    partially_received: [{ label: "Receive More", action: "receive", permission: "purchase:edit" }],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Purchase requests, approvals, receiving, and GRN generation"
        actions={
          can("purchase:create") ? (
            <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> New PO</Button>
          ) : null
        }
      />
      <PurchasePipeline
        byStatus={purchaseByStatus}
        recentOrders={recentPurchaseOrders}
        activeStatusFilter={statusFilter}
        onStageClick={(status) => {
          setStatusFilter((current) => (current === status ? "" : status));
          setPage(1);
        }}
        onViewOrder={(po) => void openDetail(po)}
        showCreateAction={false}
      />
      <Select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="w-48"
        options={[
          { value: "", label: "All statuses" },
          ...["draft", "requested", "approved", "ordered", "in_transit", "partially_received", "received", "cancelled"].map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          })),
        ]}
      />
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} />

      <Modal open={formOpen} onOpenChange={setFormOpen} title="New Purchase Order" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Branch</Label>
            <Select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              options={branches.map((b) => ({ value: b._id, label: b.name }))}
            />
          </div>
          <div><Label>Supplier *</Label>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              placeholder="Select supplier"
              options={(suppliersData?.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
            />
          </div>
        </div>
        <div className="mt-4 rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">Line Items</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Product"
              options={(productsData?.data ?? []).map((p) => ({ value: p._id, label: p.name }))}
            />
            <Input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input type="number" placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            <Button type="button" variant="secondary" onClick={addItem}>Add</Button>
          </div>
          {items.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm">
              {items.map((i, idx) => {
                const p = (productsData?.data ?? []).find((x) => x._id === i.productId);
                return <li key={idx}>{p?.name} × {i.quantityOrdered} @ {i.unitCost} OMR</li>;
              })}
            </ul>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button disabled={!supplierId || items.length === 0 || createMut.isPending} onClick={() => createMut.mutate()}>Create PO</Button>
        </div>
      </Modal>

      <Modal open={detailOpen} onOpenChange={setDetailOpen} title={selected?.poNumber ?? "Purchase Order"} size="lg">
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-sm text-muted-foreground">{refName(selected.supplierId)} · {refName(selected.branchId)}</span>
            </div>
            <div className="space-y-2">
              {selected.items.map((item) => {
                const id = typeof item.productId === "object" ? item.productId._id : item.productId;
                const name = typeof item.productId === "object" ? item.productId.name : id;
                return (
                  <div key={id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <span>{name}</span>
                    <span>{item.quantityReceived}/{item.quantityOrdered} @ {item.unitCost} OMR</span>
                    {["in_transit", "partially_received", "ordered"].includes(selected.status) ? (
                      <Input className="w-20" type="number" value={receiveQtys[id] ?? ""} onChange={(e) => setReceiveQtys({ ...receiveQtys, [id]: e.target.value })} />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <ReceiptActions purchase={selected} className="border-t border-border pt-4" />
            <div className="flex flex-wrap gap-2">
              {(workflowActions[selected.status] ?? []).map((a) =>
                can(a.permission) ? (
                  <Button key={a.action} disabled={actionMut.isPending} onClick={() => actionMut.mutate(a.action)}>
                    {a.label}
                  </Button>
                ) : null
              )}
              {can("purchase:delete") && !["received", "cancelled"].includes(selected.status) ? (
                <Button variant="secondary" disabled={actionMut.isPending} className="bg-destructive text-white" onClick={() => actionMut.mutate("cancel")}>Cancel</Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
