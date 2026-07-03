"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { ReceiptActions } from "@/components/features/orders/ReceiptActions";
import { salesApi } from "@/lib/api/customers";

function refName(ref: string | { name?: string; sku?: string; firstName?: string; lastName?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  if (ref.firstName || ref.lastName) return [ref.firstName, ref.lastName].filter(Boolean).join(" ");
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

interface SaleDetailModalProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleDetailModal({ saleId, open, onOpenChange }: SaleDetailModalProps) {
  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => salesApi.get(saleId!),
    enabled: !!saleId && open,
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={sale?.saleNumber ? `Sale ${sale.saleNumber}` : "Sale Details"}
      size="lg"
    >
      {isLoading || !sale ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{refName(sale.customerId)}</p>
              {typeof sale.customerId === "object" && sale.customerId.phone ? (
                <p className="text-xs text-muted-foreground">{sale.customerId.phone}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Branch</p>
              <p className="font-medium">{refName(sale.branchId)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sold By</p>
              <p className="font-medium">{refName(sale.soldBy) || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{formatDate(sale.createdAt)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Order Item</p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Product</p>
                <p className="font-medium">{refName(sale.productId)}</p>
                {typeof sale.productId === "object" ? (
                  <p className="text-xs text-muted-foreground">SKU: {sale.productId.sku}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="font-medium">{sale.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unit Price</p>
                <p className="font-medium">{formatAmount(sale.unitPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{formatAmount(sale.totalAmount)}</p>
              </div>
            </div>
          </div>

          {sale.notes ? (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{sale.notes}</p>
            </div>
          ) : null}

          <ReceiptActions sale={sale} />
        </div>
      )}
    </Modal>
  );
}
