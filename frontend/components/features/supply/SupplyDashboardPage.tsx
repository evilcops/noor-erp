"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  Package,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { BranchSubBranchSelect } from "@/components/common/BranchSubBranchSelect";
import { effectiveBranchId } from "@/lib/branch-utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { inventoryApi } from "@/lib/api/inventory";
import { PurchasePipeline } from "@/components/features/purchases/PurchasePipeline";
import type { StockLevel } from "@/types/inventory";

function refName(ref: string | { name?: string; sku?: string; _id?: string } | undefined, field: "name" | "sku" = "name") {
  if (!ref) return "—";
  if (typeof ref === "string") return ref;
  return ref[field] ?? "—";
}

function refId(ref: string | { _id?: string } | undefined) {
  if (!ref) return "";
  return typeof ref === "string" ? ref : ref._id ?? "";
}

function restockHref(item: StockLevel) {
  const params = new URLSearchParams({
    productId: refId(item.productId),
    branchId: refId(item.branchId),
    qty: String(item.suggestedRestockQty ?? 1),
    restock: "1",
  });
  return `/purchases?${params}`;
}

function SupplyDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading supply dashboard">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-14" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SupplyDashboardPage() {
  const { user } = useAuth();
  const { branches, activeMainBranchId, activeSubBranchId } = useBranch();
  const { can } = usePermissions();
  const [mainBranchFilter, setMainBranchFilter] = useState(activeMainBranchId ?? "");
  const [subBranchFilter, setSubBranchFilter] = useState(activeSubBranchId ?? "");
  const branchFilter = effectiveBranchId(mainBranchFilter, subBranchFilter);

  const { data: d, isLoading } = useQuery({
    queryKey: ["inventory-dashboard", branchFilter],
    queryFn: () => inventoryApi.dashboard(branchFilter || undefined),
    enabled: !!user,
  });

  if (isLoading) return <SupplyDashboardSkeleton />;

  const lowStock = d?.lowStock ?? [];
  const outOfStock = d?.outOfStock ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supply Dashboard"
        description="Inventory and supply chain overview across branches"
        actions={
          <div className="flex flex-wrap gap-2">
            <BranchSubBranchSelect
              branches={branches}
              mainBranchId={mainBranchFilter}
              subBranchId={subBranchFilter}
              onMainBranchChange={(id) => {
                setMainBranchFilter(id);
                setSubBranchFilter("");
              }}
              onSubBranchChange={setSubBranchFilter}
              allowAllMain
            />
            <Link href="/products"><Button variant="secondary">Products</Button></Link>
            <Link href="/purchases"><Button>Purchase Orders</Button></Link>
          </div>
        }
      />

      {(d?.lowStockCount ?? 0) > 0 ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {d?.lowStockCount} product{(d?.lowStockCount ?? 0) !== 1 ? "s" : ""} below reorder level
                </p>
                <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80">
                  Current stock is at or below the reorder quantity. Create a purchase order to restock these items.
                </p>
              </div>
            </div>
            {can("purchase:create") ? (
              <Link href="/purchases">
                <Button size="sm">Create Purchase Order</Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Products", value: d?.totalProducts ?? 0, icon: Package, color: "text-brand" },
          { label: "Reorder Alerts", value: d?.lowStockCount ?? 0, icon: AlertTriangle, color: "text-amber-600" },
          { label: "Out of Stock", value: d?.outOfStockCount ?? 0, icon: Warehouse, color: "text-destructive" },
          { label: "Active Suppliers", value: d?.activeSuppliers ?? 0, icon: Truck, color: "text-blue-600" },
          { label: "Pending POs", value: d?.pendingPurchaseOrders ?? 0, icon: ShoppingCart, color: "text-violet-600" },
          { label: "Stock In Transit", value: d?.stockInTransit ?? 0, icon: Truck, color: "text-indigo-600" },
          { label: "Pending Transfers", value: d?.pendingTransfers ?? 0, icon: ArrowRightLeft, color: "text-emerald-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {can("purchase:view") ? (
        <PurchasePipeline
          byStatus={d?.purchaseByStatus ?? {}}
          recentOrders={d?.recentPurchaseOrders ?? []}
          canCreate={can("purchase:create")}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Restock Alerts</h2>
            <Link href="/inventory"><Button variant="ghost">View inventory</Button></Link>
          </div>
          <div className="space-y-2">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">All products are above reorder level.</p>
            ) : (
              lowStock.map((item) => (
                <div
                  key={item._id}
                  className="flex flex-col gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{refName(item.productId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {refName(item.branchId)} · {refName(item.productId, "sku")}
                    </p>
                    <p className="mt-1 text-xs">
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{item.currentStock}</span>
                      <span className="text-muted-foreground"> in stock · reorder at </span>
                      <span className="font-semibold">{item.effectiveReorderLevel ?? item.reorderLevel ?? 0}</span>
                      {item.suggestedRestockQty ? (
                        <span className="text-muted-foreground"> · order </span>
                      ) : null}
                      {item.suggestedRestockQty ? (
                        <span className="font-semibold text-brand">{item.suggestedRestockQty} units</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={item.currentStock <= 0 ? "out_of_stock" : "warning"} />
                    {can("purchase:create") ? (
                      <Link href={restockHref(item)}>
                        <Button size="sm" variant="secondary">Restock</Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Out of Stock</h2>
            <Link href="/inventory"><Button variant="ghost">Inventory</Button></Link>
          </div>
          <div className="space-y-2">
            {outOfStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">No out-of-stock items.</p>
            ) : (
              outOfStock.map((item) => (
                <div key={item._id} className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{refName(item.productId)}</p>
                    <p className="text-xs text-muted-foreground">{refName(item.branchId)}</p>
                  </div>
                  {can("purchase:create") ? (
                    <Link href={restockHref(item)}>
                      <Button size="sm" variant="secondary">Order</Button>
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Branch Stock Summary</h2>
          <Link href="/inventory"><Button variant="ghost">Inventory</Button></Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(d?.branchSummary ?? []).map((b) => (
            <div key={String(b.branchId)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{b.branchName}</p>
                <p className="text-xs text-muted-foreground">{b.totalItems} SKUs tracked</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{b.totalQty} units</p>
                {b.lowStockCount > 0 ? (
                  <p className="text-xs font-medium text-amber-600">{b.lowStockCount} need restock</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Stock OK</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
