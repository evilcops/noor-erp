"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ReceiptActions } from "@/components/features/orders/ReceiptActions";
import { purchaseApi } from "@/lib/api/purchases";

function refName(ref: string | { name?: string; sku?: string; contactPerson?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.sku ?? "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatAmount(value?: number) {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(3)} OMR`;
}

interface PurchaseOrderDetailModalProps {
  purchaseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseOrderDetailModal({ purchaseId, open, onOpenChange }: PurchaseOrderDetailModalProps) {
  const { data: po, isLoading } = useQuery({
    queryKey: ["purchase", purchaseId],
    queryFn: () => purchaseApi.get(purchaseId!),
    enabled: !!purchaseId && open,
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={po?.poNumber ? `Purchase Order ${po.poNumber}` : "Purchase Order Details"}
      size="lg"
    >
      {isLoading || !po ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={po.status} />
            <span className="text-sm text-muted-foreground">
              {refName(po.supplierId)} · {refName(po.branchId)}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Supplier</p>
              <p className="font-medium">{refName(po.supplierId)}</p>
              {typeof po.supplierId === "object" && po.supplierId.contactPerson ? (
                <p className="text-xs text-muted-foreground">{po.supplierId.contactPerson}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Branch</p>
              <p className="font-medium">{refName(po.branchId)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(po.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="text-lg font-bold">{formatAmount(po.totalAmount)}</p>
            </div>
            {po.expectedDeliveryDate ? (
              <div>
                <p className="text-xs text-muted-foreground">Expected Delivery</p>
                <p className="font-medium">{formatDate(po.expectedDeliveryDate)}</p>
              </div>
            ) : null}
            {po.receivedAt ? (
              <div>
                <p className="text-xs text-muted-foreground">Received</p>
                <p className="font-medium">{formatDate(po.receivedAt)}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Line Items</p>
            </div>
            <div className="divide-y divide-border">
              {po.items.map((item, idx) => {
                const productId = typeof item.productId === "object" ? item.productId._id : item.productId;
                const lineTotal = item.quantityOrdered * item.unitCost;
                return (
                  <div key={`${productId}-${idx}`} className="grid gap-2 px-4 py-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <p className="font-medium">{refName(item.productId)}</p>
                      {typeof item.productId === "object" ? (
                        <p className="text-xs text-muted-foreground">SKU: {item.productId.sku}</p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Qty</p>
                      <p className="text-sm">
                        {item.quantityReceived}/{item.quantityOrdered}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Line Total</p>
                      <p className="text-sm font-medium">{formatAmount(lineTotal)}</p>
                      <p className="text-xs text-muted-foreground">@ {formatAmount(item.unitCost)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {po.notes ? (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{po.notes}</p>
            </div>
          ) : null}

          <ReceiptActions purchase={po} />
        </div>
      )}
    </Modal>
  );
}
