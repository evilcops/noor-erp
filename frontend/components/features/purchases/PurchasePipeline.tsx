"use client";

import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { PurchaseOrder } from "@/types/purchase";

export const PO_PIPELINE_STAGES: {
  key: string;
  label: string;
  color: string;
  bg: string;
}[] = [
  { key: "draft", label: "Draft", color: "#64748b", bg: "bg-slate-100 dark:bg-slate-800" },
  { key: "requested", label: "Requested", color: "#3b82f6", bg: "bg-blue-100 dark:bg-blue-900/30" },
  { key: "approved", label: "Approved", color: "#8b5cf6", bg: "bg-violet-100 dark:bg-violet-900/30" },
  { key: "ordered", label: "Ordered", color: "#06b6d4", bg: "bg-cyan-100 dark:bg-cyan-900/30" },
  { key: "in_transit", label: "In Transit", color: "#f59e0b", bg: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "partially_received", label: "Partial", color: "#f97316", bg: "bg-orange-100 dark:bg-orange-900/30" },
  { key: "received", label: "Received", color: "#10b981", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
];

function refName(ref: string | { name?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? "—";
}

export function buildPurchasePipelineStages(byStatus: Record<string, number>) {
  const activeTotal = PO_PIPELINE_STAGES.reduce((sum, stage) => sum + (byStatus[stage.key] ?? 0), 0);
  return PO_PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: byStatus[stage.key] ?? 0,
    pct: activeTotal ? Math.round(((byStatus[stage.key] ?? 0) / activeTotal) * 100) : 0,
  })).filter(
    (stage) =>
      stage.count > 0 ||
      ["draft", "requested", "approved", "ordered", "in_transit"].includes(stage.key)
  );
}

interface PurchasePipelineProps {
  byStatus: Record<string, number>;
  recentOrders?: PurchaseOrder[];
  activeStatusFilter?: string;
  onStageClick?: (status: string) => void;
  onViewOrder?: (order: PurchaseOrder) => void;
  showCreateAction?: boolean;
  canCreate?: boolean;
  className?: string;
}

export function PurchasePipeline({
  byStatus,
  recentOrders = [],
  activeStatusFilter,
  onStageClick,
  onViewOrder,
  showCreateAction = true,
  canCreate = false,
  className,
}: PurchasePipelineProps) {
  const pipelineStages = buildPurchasePipelineStages(byStatus);
  const totalOrders = pipelineStages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <section className={`rounded-xl border border-border bg-card ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="h-4 w-4 text-brand" /> Purchase Order Pipeline
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalOrders} active</span>
          <Link href="/purchases">
            <Button variant="ghost" className="h-7 px-2 text-xs">View all →</Button>
          </Link>
        </div>
      </div>

      <div className="p-6">
        {totalOrders > 0 ? (
          <div className="space-y-3">
            {pipelineStages.map((stage) => (
              <button
                key={stage.key}
                type="button"
                onClick={() => onStageClick?.(stage.key)}
                disabled={!onStageClick}
                className={`flex w-full items-center gap-3 rounded-lg text-left transition-colors ${
                  onStageClick ? "hover:bg-muted/40" : ""
                } ${activeStatusFilter === stage.key ? "bg-muted/50 ring-1 ring-brand/30" : ""}`}
              >
                <div className="w-24 shrink-0 text-right">
                  <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                </div>
                <div className="flex-1 overflow-hidden rounded-full bg-muted/40" style={{ height: 28 }}>
                  <div
                    className="flex h-full items-center rounded-full px-3 transition-all duration-500"
                    style={{
                      width: stage.pct > 0 ? `${Math.max(stage.pct, 8)}%` : "0%",
                      backgroundColor: `${stage.color}28`,
                      borderLeft: `3px solid ${stage.color}`,
                    }}
                  >
                    {stage.count > 0 ? (
                      <span className="text-xs font-bold" style={{ color: stage.color }}>
                        {stage.count}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="w-10 shrink-0 text-right">
                  <span className="text-xs text-muted-foreground">
                    {stage.pct > 0 ? `${stage.pct}%` : "—"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No purchase orders in the pipeline yet.</p>
            {showCreateAction && canCreate ? (
              <Link href="/purchases">
                <Button variant="secondary" className="mt-1 h-8 text-xs">
                  <Plus className="mr-1 h-3 w-3" />
                  Create PO
                </Button>
              </Link>
            ) : null}
          </div>
        )}

        <div className="my-5 border-t border-border" />

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Purchase Orders
        </h3>
        {recentOrders.length > 0 ? (
          <div className="space-y-2">
            {recentOrders.slice(0, 5).map((po) => (
              <button
                key={po._id}
                type="button"
                onClick={() => onViewOrder?.(po)}
                disabled={!onViewOrder}
                className={`flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left ${
                  onViewOrder ? "transition-colors hover:bg-muted/30" : ""
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                  PO
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{po.poNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {refName(po.supplierId)} · {refName(po.branchId)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge status={po.status} />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{po.totalAmount.toFixed(3)} OMR</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recent purchase orders.</p>
        )}
      </div>
    </section>
  );
}
