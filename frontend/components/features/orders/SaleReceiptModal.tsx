"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ReceiptActions } from "@/components/features/orders/ReceiptActions";
import type { Sale } from "@/types/customer";

function refName(ref: string | { name?: string; sku?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.sku ?? "—";
}

function formatAmount(value?: number) {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(3)} OMR`;
}

interface SaleReceiptModalProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName?: string;
}

export function SaleReceiptModal({ sale, open, onOpenChange, companyName }: SaleReceiptModalProps) {
  if (!sale) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Sale Receipt" size="md">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sale <span className="font-mono font-medium text-foreground">{sale.saleNumber}</span> was recorded successfully.
          Print the customer receipt below.
        </p>

        <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
          <p className="font-medium">{refName(sale.customerId)}</p>
          <p className="text-muted-foreground">{refName(sale.productId)} × {sale.quantity}</p>
          <p className="mt-2 text-lg font-bold">{formatAmount(sale.totalAmount)}</p>
        </div>

        <ReceiptActions sale={sale} companyName={companyName} />

        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
