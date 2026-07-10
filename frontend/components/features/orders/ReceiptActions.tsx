"use client";

import { useMutation } from "@tanstack/react-query";
import { Bike, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { purchaseApi } from "@/lib/api/purchases";
import { printPurchaseReceipt } from "@/lib/pdf/purchase-receipt";
import { printSaleReceipt } from "@/lib/pdf/sale-receipt";
import type { Sale } from "@/types/customer";
import type { PurchaseOrder, PurchaseStatus } from "@/types/purchase";

interface ReceiptActionsProps {
  companyName?: string;
  className?: string;
  sale?: Sale;
  purchase?: PurchaseOrder;
}

const PURCHASE_RECEIPT_STATUSES: PurchaseStatus[] = [
  "ordered",
  "in_transit",
  "partially_received",
  "received",
];

function canShowPurchaseReceipt(status: PurchaseStatus) {
  return PURCHASE_RECEIPT_STATUSES.includes(status);
}

function supplierEmail(purchase: PurchaseOrder) {
  if (typeof purchase.supplierId === "object") return purchase.supplierId.email;
  return undefined;
}

export function ReceiptActions({ companyName = "NOOR ERP", className, sale, purchase }: ReceiptActionsProps) {
  const sendToSupplierMut = useMutation({
    mutationFn: () => purchaseApi.sendToSupplier(purchase!._id),
    onSuccess: (data) => toast.success(data.message),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!sale && !purchase) return null;

  if (purchase && !canShowPurchaseReceipt(purchase.status)) return null;

  const handlePrint = () => {
    if (sale) printSaleReceipt(sale, companyName);
    else if (purchase) printPurchaseReceipt(purchase, companyName);
  };

  const handleSendToRider = () => {
    toast.message("Send to rider will be available soon.");
  };

  const email = purchase ? supplierEmail(purchase) : undefined;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <Button type="button" onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>


      {purchase ? (
        <Button
          type="button"
          variant="secondary"
          disabled={!email || sendToSupplierMut.isPending}
          onClick={() => sendToSupplierMut.mutate()}
          title={email ? `Send to ${email}` : "Supplier has no email address"}
        >
          <Mail className="mr-2 h-4 w-4" />
          {sendToSupplierMut.isPending ? "Sending..." : "Send to Supplier"}
        </Button>
      ) : null}
    </div>
  );
}
