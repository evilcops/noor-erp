"use client";

import { useMemo, useState } from "react";
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
import { useAuth, useBranch, useTenantIds } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { stockTransferApi } from "@/lib/api/inventory";
import { productApi } from "@/lib/api/products";
import type { StockTransfer } from "@/types/purchase";

function refName(ref: string | { name?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? "—";
}

export function StockTransfersPage() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<StockTransfer | null>(null);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [items, setItems] = useState<{ productId: string; quantityRequested: number }[]>([]);
  const [dispatchQtys, setDispatchQtys] = useState<Record<string, string>>({});
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});

  const { companyId } = useTenantIds();

  const { data, isLoading } = useQuery({
    queryKey: ["stock-transfers", page],
    queryFn: () => stockTransferApi.list({ page, limit: 20 }),
    enabled: !!user,
  });

  const { data: productsData } = useQuery({
    queryKey: ["products-for-transfer"],
    queryFn: () => productApi.list({ limit: 100, status: "active" }),
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: () => stockTransferApi.create({ companyId, fromBranchId, toBranchId, items }),
    onSuccess: () => {
      toast.success("Transfer requested");
      setFormOpen(false);
      setItems([]);
      void qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionMut = useMutation({
    mutationFn: async (action: string) => {
      if (!selected) return;
      if (action === "approve") return stockTransferApi.approve(selected._id);
      if (action === "reject") return stockTransferApi.reject(selected._id);
      if (action === "dispatch") {
        const dispatchItems = selected.items.map((i) => ({
          productId: typeof i.productId === "object" ? i.productId._id : i.productId,
          quantityDispatched: Number(dispatchQtys[typeof i.productId === "object" ? i.productId._id : i.productId] ?? 0),
        })).filter((i) => i.quantityDispatched > 0);
        return stockTransferApi.dispatch(selected._id, dispatchItems);
      }
      if (action === "receive") {
        const receiveItems = selected.items.map((i) => ({
          productId: typeof i.productId === "object" ? i.productId._id : i.productId,
          quantityReceived: Number(receiveQtys[typeof i.productId === "object" ? i.productId._id : i.productId] ?? 0),
        })).filter((i) => i.quantityReceived > 0);
        return stockTransferApi.receive(selected._id, receiveItems);
      }
      if (action === "cancel") return stockTransferApi.cancel(selected._id);
    },
    onSuccess: async () => {
      toast.success("Transfer updated");
      if (selected) setSelected(await stockTransferApi.get(selected._id));
      void qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      void qc.invalidateQueries({ queryKey: ["stock-levels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDetail = async (t: StockTransfer) => {
    const full = await stockTransferApi.get(t._id);
    setSelected(full);
    const dQtys: Record<string, string> = {};
    const rQtys: Record<string, string> = {};
    full.items.forEach((i) => {
      const id = typeof i.productId === "object" ? i.productId._id : i.productId;
      dQtys[id] = String(i.quantityRequested - i.quantityDispatched);
      rQtys[id] = String(i.quantityDispatched - i.quantityReceived);
    });
    setDispatchQtys(dQtys);
    setReceiveQtys(rQtys);
    setDetailOpen(true);
  };

  const columns: Column<StockTransfer>[] = useMemo(
    () => [
      { key: "num", header: "Transfer #", cell: (r) => <span className="font-mono text-sm">{r.transferNumber}</span> },
      { key: "from", header: "From", cell: (r) => refName(r.fromBranchId) },
      { key: "to", header: "To", cell: (r) => refName(r.toBranchId) },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      {
        key: "actions",
        header: "",
        cell: (r) => <Button variant="ghost" size="icon" onClick={() => void openDetail(r)}><Eye className="h-4 w-4" /></Button>,
      },
    ],
    []
  );

  const workflow: Record<string, { label: string; action: string; permission: string }[]> = {
    requested: [
      { label: "Approve", action: "approve", permission: "stock_transfer:approve" },
      { label: "Reject", action: "reject", permission: "stock_transfer:approve" },
    ],
    approved: [{ label: "Dispatch", action: "dispatch", permission: "stock_transfer:edit" }],
    dispatched: [{ label: "Confirm Receipt", action: "receive", permission: "stock_transfer:edit" }],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers"
        description="Request, approve, dispatch, and receive stock between branches"
        actions={
          can("stock_transfer:create") ? (
            <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Transfer</Button>
          ) : null
        }
      />
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} />

      <Modal open={formOpen} onOpenChange={setFormOpen} title="Request Stock Transfer" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>From Branch *</Label>
            <BranchSubBranchSelect
              branches={branches}
              mainBranchId={resolveMainAndSubBranchId(fromBranchId, branches).mainId}
              subBranchId={resolveMainAndSubBranchId(fromBranchId, branches).subId}
              onMainBranchChange={(id) => setFromBranchId(id)}
              onSubBranchChange={(id) => {
                const mainId = resolveMainAndSubBranchId(fromBranchId, branches).mainId;
                setFromBranchId(id || mainId);
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>To Branch *</Label>
            <BranchSubBranchSelect
              branches={branches}
              mainBranchId={resolveMainAndSubBranchId(toBranchId, branches).mainId}
              subBranchId={resolveMainAndSubBranchId(toBranchId, branches).subId}
              onMainBranchChange={(id) => setToBranchId(id)}
              onSubBranchChange={(id) => {
                const mainId = resolveMainAndSubBranchId(toBranchId, branches).mainId;
                setToBranchId(id || mainId);
              }}
            />
          </div>
        </div>
        <div className="mt-4 rounded-lg border p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Product"
              options={(productsData?.data ?? []).map((p) => ({ value: p._id, label: p.name }))}
            />
            <Input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Button type="button" variant="secondary" onClick={() => {
              if (!productId) return;
              setItems([...items, { productId, quantityRequested: Number(qty) }]);
              setProductId("");
              setQty("1");
            }}>Add</Button>
          </div>
          {items.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm">
              {items.map((i, idx) => {
                const p = (productsData?.data ?? []).find((x) => x._id === i.productId);
                return <li key={idx}>{p?.name} × {i.quantityRequested}</li>;
              })}
            </ul>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button disabled={!fromBranchId || !toBranchId || items.length === 0 || createMut.isPending} onClick={() => createMut.mutate()}>Submit Request</Button>
        </div>
      </Modal>

      <Modal open={detailOpen} onOpenChange={setDetailOpen} title={selected?.transferNumber ?? "Transfer"} size="lg">
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{refName(selected.fromBranchId)} → {refName(selected.toBranchId)}</p>
            <StatusBadge status={selected.status} />
            <div className="space-y-2">
              {selected.items.map((item) => {
                const id = typeof item.productId === "object" ? item.productId._id : item.productId;
                const name = typeof item.productId === "object" ? item.productId.name : id;
                return (
                  <div key={id} className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
                    <span>{name}</span>
                    <span>Req {item.quantityRequested} / Disp {item.quantityDispatched} / Rec {item.quantityReceived}</span>
                    {selected.status === "approved" ? (
                      <Input className="w-20" type="number" value={dispatchQtys[id] ?? ""} onChange={(e) => setDispatchQtys({ ...dispatchQtys, [id]: e.target.value })} />
                    ) : null}
                    {selected.status === "dispatched" ? (
                      <Input className="w-20" type="number" value={receiveQtys[id] ?? ""} onChange={(e) => setReceiveQtys({ ...receiveQtys, [id]: e.target.value })} />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {(workflow[selected.status] ?? []).map((a) =>
                can(a.permission) ? (
                  <Button key={a.action} disabled={actionMut.isPending} onClick={() => actionMut.mutate(a.action)}>{a.label}</Button>
                ) : null
              )}
              {can("stock_transfer:delete") && !["dispatched", "received"].includes(selected.status) ? (
                <Button variant="secondary" disabled={actionMut.isPending} className="bg-destructive text-white" onClick={() => actionMut.mutate("cancel")}>Cancel</Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
