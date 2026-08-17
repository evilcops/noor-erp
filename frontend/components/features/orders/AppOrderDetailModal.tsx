"use client";

import { Bike } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { AppOrder } from "@/lib/api/app-orders";
import { saleProductLabel, saleProductSku } from "@/lib/sale-items";

function customerBlock(order: AppOrder) {
  const c = order.customerId;
  if (!c || typeof c === "string") {
    return { name: "—", phone: "", address: "" };
  }
  return {
    name: c.name || c.phone || "—",
    phone: c.phone || "",
    address: [c.address, c.area].filter(Boolean).join(", "),
  };
}

function branchLabel(order: AppOrder) {
  const b = order.branchId;
  if (!b || typeof b === "string") return "—";
  return b.name || b.code || "—";
}

function fulfillmentStatus(order: AppOrder) {
  if (order.status === "cancelled" || order.delivery?.status === "cancelled") return "cancelled";
  if (order.delivery?.status === "refused") return "refused";
  if (order.delivery?.status === "delivered" || order.status === "completed") return "completed";
  return order.delivery?.status || "pending";
}

function formatMoney(value?: number) {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(3)} OMR`;
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function lineItems(order: AppOrder) {
  if (order.items && order.items.length > 0) return order.items;
  return [];
}

interface AppOrderDetailModalProps {
  order: AppOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppOrderDetailModal({
  order,
  open,
  onOpenChange,
}: AppOrderDetailModalProps) {
  const customer = order ? customerBlock(order) : null;
  const status = order ? fulfillmentStatus(order) : "pending";
  const lines = order ? lineItems(order) : [];
  const eta =
    order?.delivery?.estimatedArrival || order?.delivery?.promisedWindowEnd;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={order?.saleNumber ? `Order ${order.saleNumber}` : "Order details"}
      description="Store app order details"
      size="lg"
    >
      {!order ? (
        <p className="text-sm text-muted-foreground">No order selected.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {order.delivery?.deliveryNumber ? (
              <span className="text-xs text-muted-foreground">
                {order.delivery.deliveryNumber}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{customer?.name}</p>
              {customer?.phone ? (
                <p className="text-xs text-muted-foreground">{customer.phone}</p>
              ) : null}
              {customer?.address ? (
                <p className="text-xs text-muted-foreground">{customer.address}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Branch</p>
              <p className="font-medium">{branchLabel(order)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Placed</p>
              <p className="font-medium">{formatWhen(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ETA</p>
              <p className="font-medium">
                {order.status === "cancelled" ? "—" : formatWhen(eta)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rider</p>
              {order.riderAssigned ? (
                <div className="flex items-center gap-1.5">
                  <Bike className="h-3.5 w-3.5 text-brand" />
                  <div>
                    <p className="font-medium">{order.riderName || "Assigned"}</p>
                    {order.riderCode ? (
                      <p className="text-xs text-muted-foreground">{order.riderCode}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="font-medium text-amber-600">Unassigned</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Warehouse</p>
              <p className="font-medium">
                {order.delivery?.warehouseStatus
                  ? order.delivery.warehouseStatus.replace(/_/g, " ")
                  : "—"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">
                Order items ({lines.length || order.quantity})
              </p>
            </div>
            <div className="divide-y divide-border">
              {lines.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No line items recorded ({order.quantity} item
                  {order.quantity === 1 ? "" : "s"} total).
                </div>
              ) : (
                lines.map((line, index) => (
                  <div
                    key={`${saleProductLabel(line.productId)}-${index}`}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-4"
                  >
                    <div className="sm:col-span-2">
                      <p className="font-medium">{saleProductLabel(line.productId)}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {saleProductSku(line.productId)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Qty × Price</p>
                      <p className="font-medium">
                        {line.quantity} × {formatMoney(line.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Line total</p>
                      <p className="font-medium">{formatMoney(line.lineTotal)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">Grand total</p>
              <p className="text-lg font-bold">{formatMoney(order.totalAmount)}</p>
            </div>
          </div>

          {order.notes ? (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
