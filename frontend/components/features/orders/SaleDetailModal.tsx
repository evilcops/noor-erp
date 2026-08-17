"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { ReceiptActions } from "@/components/features/orders/ReceiptActions";
import { salesApi } from "@/lib/api/customers";
import { getSaleLineItems, saleProductLabel, saleProductSku } from "@/lib/sale-items";

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

  const lines = sale ? getSaleLineItems(sale) : [];

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

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">
                Order Items ({lines.length})
              </p>
            </div>
            <div className="divide-y divide-border">
              {lines.map((line, index) => (
                <div
                  key={`${saleProductLabel(line.productId)}-${index}`}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-4"
                >
                  <div className="sm:col-span-2">
                    <p className="font-medium">{saleProductLabel(line.productId)}</p>
                    <p className="text-xs text-muted-foreground">SKU: {saleProductSku(line.productId)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qty × Price</p>
                    <p className="font-medium">
                      {line.quantity} × {formatAmount(line.unitPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Line total</p>
                    <p className="font-medium">{formatAmount(line.lineTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">Grand total</p>
              <p className="text-lg font-bold">{formatAmount(sale.totalAmount)}</p>
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
