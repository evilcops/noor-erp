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
import { BranchSubBranchSelect } from "@/components/common/BranchSubBranchSelect";
import { Select } from "@/components/ui/Select";
import { resolveMainAndSubBranchId } from "@/lib/branch-utils";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { purchaseApi } from "@/lib/api/purchases";
import { supplierApi } from "@/lib/api/suppliers";
import { productApi } from "@/lib/api/products";
import { PurchasePipeline } from "@/components/features/purchases/PurchasePipeline";
import { ReceiptActions } from "@/components/features/orders/ReceiptActions";
import type { AmendPurchaseItemInput, PurchaseOrder } from "@/types/purchase";

function formatPrice(value?: number) {
  if (value === undefined || value === null) return "";
  return value.toFixed(3);
}

function resolveItemSellPrice(item: PurchaseOrder["items"][number]): number | undefined {
  if (item.previousSellingPrice != null) return item.previousSellingPrice;
  if (typeof item.productId === "object" && item.productId.sellingPrice != null) {
    return item.productId.sellingPrice;
  }
  return undefined;
}

function resolveItemPurchasePrice(item: PurchaseOrder["items"][number]): number | undefined {
  if (item.previousPurchaseCost != null) return item.previousPurchaseCost;
  if (typeof item.productId === "object" && item.productId.purchaseCost != null) {
    return item.productId.purchaseCost;
  }
  return item.unitCost;
}

type DraftLineItem = {
  productId: string;
  quantityOrdered: number;
  unitCost: number;
  previousSellingPrice: number;
};

const AMENDABLE_STATUSES = new Set(["ordered", "in_transit", "partially_received"]);

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
  const [sellingPrice, setSellingPrice] = useState("");
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [amendItems, setAmendItems] = useState<Record<string, AmendPurchaseItemInput>>({});

  const companyId = user?.companyId ?? branches[0]?.companyId ?? "";

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

  const { data: selectedProduct } = useQuery({
    queryKey: ["product", productId, "po-form"],
    queryFn: () => productApi.get(productId),
    enabled: !!productId && formOpen,
  });

  useEffect(() => {
    if (!productId) {
      setUnitCost("");
      setSellingPrice("");
      return;
    }
    if (!selectedProduct) return;
    setUnitCost(selectedProduct.purchaseCost != null ? String(selectedProduct.purchaseCost) : "");
    setSellingPrice(selectedProduct.sellingPrice != null ? String(selectedProduct.sellingPrice) : "");
  }, [productId, selectedProduct]);

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
    if (product) {
      setUnitCost(String(product.purchaseCost ?? 0));
      setSellingPrice(String(product.sellingPrice ?? 0));
    }
    if (product && qtyParam) {
      setItems([
        {
          productId: productIdParam,
          quantityOrdered: Number(qtyParam) || 1,
          unitCost: product?.purchaseCost ?? 0,
          previousSellingPrice: product?.sellingPrice ?? 0,
        },
      ]);
    }

    if (canCreatePurchase) {
      setFormOpen(true);
      restockHandled.current = true;
    }
  }, [searchParams, productsData?.data, canCreatePurchase]);

  const createMut = useMutation({
    mutationFn: () =>
      purchaseApi.create({
        companyId,
        branchId,
        supplierId,
        items: items.map((i) => ({
          productId: i.productId,
          quantityOrdered: i.quantityOrdered,
          unitCost: i.unitCost,
        })),
      }),
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

  const amendMut = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error("No purchase order selected"));
      return purchaseApi.amend(selected._id, Object.values(amendItems));
    },
    onSuccess: async () => {
      toast.success("Purchase order and product prices updated");
      if (selected) {
        const updated = await purchaseApi.get(selected._id);
        setSelected(updated);
        initAmendItems(updated);
      }
      void qc.invalidateQueries({ queryKey: ["purchases"] });
      void qc.invalidateQueries({ queryKey: ["purchases-pipeline"] });
      void qc.invalidateQueries({ queryKey: ["products-active"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
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
        initAmendItems(updated);
      }
      void qc.invalidateQueries({ queryKey: ["purchases"] });
      void qc.invalidateQueries({ queryKey: ["purchases-pipeline"] });
      void qc.invalidateQueries({ queryKey: ["inventory-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["stock-levels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initAmendItems = (po: PurchaseOrder) => {
    const next: Record<string, AmendPurchaseItemInput> = {};
    po.items.forEach((item) => {
      const id = typeof item.productId === "object" ? item.productId._id : item.productId;
      const prevSell = resolveItemSellPrice(item);
      next[id] = {
        productId: id,
        quantityOrdered: item.quantityOrdered,
        newPurchaseCost: item.newPurchaseCost ?? item.unitCost,
        newSellingPrice: item.newSellingPrice ?? prevSell,
      };
    });
    setAmendItems(next);
  };

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
    initAmendItems(full);
    setDetailOpen(true);
  };

  const handleProductSelect = (id: string) => {
    setProductId(id);
  };

  const addItem = () => {
    if (!productId || !qty || unitCost === "") return;
    const sell = selectedProduct?.sellingPrice ?? (sellingPrice !== "" ? Number(sellingPrice) : 0);
    setItems([
      ...items,
      {
        productId,
        quantityOrdered: Number(qty),
        unitCost: Number(unitCost),
        previousSellingPrice: sell,
      },
    ]);
    setProductId("");
    setQty("1");
    setUnitCost("");
    setSellingPrice("");
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
          <div className="sm:col-span-2">
            <Label>Branch</Label>
            <BranchSubBranchSelect
              branches={branches}
              mainBranchId={resolveMainAndSubBranchId(branchId, branches).mainId}
              subBranchId={resolveMainAndSubBranchId(branchId, branches).subId}
              onMainBranchChange={(id) => setBranchId(id)}
              onSubBranchChange={(id) =>
                setBranchId((prev) => id || resolveMainAndSubBranchId(prev, branches).mainId)
              }
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              value={productId}
              onChange={(e) => handleProductSelect(e.target.value)}
              placeholder="Product"
              options={(productsData?.data ?? []).map((p) => ({ value: p._id, label: p.name }))}
            />
            <Input type="number" min={1} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <div>
              <Input
                type="text"
                placeholder="Purchase price"
                value={
                  selectedProduct?.purchaseCost != null
                    ? formatPrice(selectedProduct.purchaseCost)
                    : unitCost !== ""
                      ? formatPrice(Number(unitCost))
                      : ""
                }
                readOnly
                className="bg-muted/50"
              />
              <p className="mt-0.5 text-xs text-muted-foreground">Purchase price (OMR)</p>
            </div>
            <div>
              <Input
                type="text"
                placeholder="Sell price"
                value={
                  selectedProduct?.sellingPrice != null
                    ? formatPrice(selectedProduct.sellingPrice)
                    : sellingPrice !== ""
                      ? formatPrice(Number(sellingPrice))
                      : ""
                }
                readOnly
                className="bg-muted/50"
              />
              <p className="mt-0.5 text-xs text-muted-foreground">Sell price (OMR)</p>
              {productId && selectedProduct && selectedProduct.sellingPrice == null ? (
                <p className="mt-0.5 text-xs text-amber-600">No sell price on product — set it under Products</p>
              ) : null}
            </div>
            <Button type="button" variant="secondary" onClick={addItem} disabled={!productId || !qty}>
              Add
            </Button>
          </div>
          {items.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm">
              {items.map((i, idx) => {
                const p = (productsData?.data ?? []).find((x) => x._id === i.productId);
                return (
                  <li key={idx}>
                    {p?.name} × {i.quantityOrdered} · purchase {formatPrice(i.unitCost)} OMR · sell{" "}
                    {formatPrice(i.previousSellingPrice)} OMR
                  </li>
                );
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
            <div className="space-y-3">
              {selected.items.map((item) => {
                const id = typeof item.productId === "object" ? item.productId._id : item.productId;
                const name = typeof item.productId === "object" ? item.productId.name : id;
                const canAmend = AMENDABLE_STATUSES.has(selected.status);
                const amend = amendItems[id];
                const prevPurchase = resolveItemPurchasePrice(item);
                const prevSell = resolveItemSellPrice(item);

                return (
                  <div key={id} className="rounded-lg border p-3 text-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{name}</span>
                      <span>
                        {item.quantityReceived}/{item.quantityOrdered} @ {formatPrice(item.unitCost)} OMR
                      </span>
                      {["in_transit", "partially_received", "ordered"].includes(selected.status) ? (
                        <Input
                          className="w-20"
                          type="number"
                          value={receiveQtys[id] ?? ""}
                          onChange={(e) => setReceiveQtys({ ...receiveQtys, [id]: e.target.value })}
                          placeholder="Recv"
                        />
                      ) : null}
                    </div>

                    {canAmend && amend ? (
                      <div className="grid gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Previous purchase price (OMR)</Label>
                          <Input
                            readOnly
                            value={formatPrice(prevPurchase)}
                            className="mt-1 bg-muted/50"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Previous sell price (OMR)</Label>
                          <Input
                            readOnly
                            value={formatPrice(prevSell)}
                            className="mt-1 bg-muted/50"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">New purchase price (OMR)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            className="mt-1"
                            value={amend.newPurchaseCost ?? ""}
                            onChange={(e) =>
                              setAmendItems({
                                ...amendItems,
                                [id]: {
                                  ...amend,
                                  newPurchaseCost: e.target.value === "" ? undefined : Number(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">New sell price (OMR)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            className="mt-1"
                            value={amend.newSellingPrice ?? ""}
                            onChange={(e) =>
                              setAmendItems({
                                ...amendItems,
                                [id]: {
                                  ...amend,
                                  newSellingPrice: e.target.value === "" ? undefined : Number(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Ordered quantity</Label>
                          <Input
                            type="number"
                            min={item.quantityReceived || 1}
                            className="mt-1 max-w-xs"
                            value={amend.quantityOrdered ?? item.quantityOrdered}
                            onChange={(e) =>
                              setAmendItems({
                                ...amendItems,
                                [id]: {
                                  ...amend,
                                  quantityOrdered: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Purchase: {formatPrice(prevPurchase) || "—"} OMR</span>
                        <span>Sell: {formatPrice(prevSell) || "—"} OMR</span>
                        {item.newPurchaseCost !== undefined ? (
                          <span>New purchase: {formatPrice(item.newPurchaseCost)} OMR</span>
                        ) : null}
                        {item.newSellingPrice !== undefined ? (
                          <span>New sell: {formatPrice(item.newSellingPrice)} OMR</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {selected && AMENDABLE_STATUSES.has(selected.status) && can("purchase:edit") ? (
              <Button
                variant="secondary"
                disabled={amendMut.isPending}
                onClick={() => amendMut.mutate()}
              >
                Save price &amp; quantity updates
              </Button>
            ) : null}
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
