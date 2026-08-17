"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, Ban, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { AppOrderDetailModal } from "@/components/features/orders/AppOrderDetailModal";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { appOrdersApi, type AppOrder } from "@/lib/api/app-orders";
import { apiRequest } from "@/lib/api/client";

function customerName(order: AppOrder) {
  const c = order.customerId;
  if (!c || typeof c === "string") return "—";
  return c.name || c.phone || "—";
}

function branchName(order: AppOrder) {
  const b = order.branchId;
  if (!b || typeof b === "string") return "—";
  return b.name || b.code || "—";
}

function orderFulfillmentStatus(order: AppOrder) {
  if (order.status === "cancelled" || order.delivery?.status === "cancelled") return "cancelled";
  if (order.delivery?.status === "refused") return "refused";
  if (order.delivery?.status === "delivered" || order.status === "completed") return "completed";
  return order.delivery?.status || "pending";
}

function formatEta(order: AppOrder) {
  const eta = order.delivery?.estimatedArrival || order.delivery?.promisedWindowEnd;
  if (!eta) return "—";
  return new Date(eta).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AppOrdersPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AppOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (order: AppOrder) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["app-orders", page, search, activeBranchId, deliveryStatus],
    queryFn: () =>
      appOrdersApi.list({
        page,
        limit: 20,
        search: search || undefined,
        branchId: activeBranchId || undefined,
        deliveryStatus: deliveryStatus || undefined,
      }),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const assignMut = useMutation({
    mutationFn: (saleId: string) =>
      apiRequest(`/app-orders/${saleId}/assign-rider`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Rider assigned");
      void qc.invalidateQueries({ queryKey: ["app-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (saleId: string) => appOrdersApi.cancel(saleId),
    onSuccess: (res) => {
      toast.success(`Order ${res.saleNumber} cancelled`);
      void qc.invalidateQueries({ queryKey: ["app-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orders = data?.data ?? [];

  const columns: Column<AppOrder>[] = useMemo(
    () => [
      {
        key: "saleNumber",
        header: "Order",
        cell: (row) => (
          <div>
            <p className="font-semibold text-brand underline-offset-2 hover:underline">
              {row.saleNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString()}
            </p>
          </div>
        ),
      },
      {
        key: "customer",
        header: "Customer",
        cell: (row) => {
          const c = row.customerId;
          return (
            <div>
              <p className="font-medium">{customerName(row)}</p>
              <p className="text-xs text-muted-foreground">
                {c && typeof c !== "string" ? c.phone || c.address || "" : ""}
              </p>
            </div>
          );
        },
      },
      {
        key: "branch",
        header: "Branch",
        cell: (row) => branchName(row),
      },
      {
        key: "total",
        header: "Total",
        cell: (row) => (
          <span className="font-semibold">{row.totalAmount.toFixed(3)} OMR</span>
        ),
      },
      {
        key: "items",
        header: "Items",
        cell: (row) => row.quantity,
      },
      {
        key: "delivery",
        header: "Delivery",
        cell: (row) => {
          const status = orderFulfillmentStatus(row);
          return status === "pending" ? (
            <span className="text-muted-foreground">Pending</span>
          ) : (
            <StatusBadge status={status} />
          );
        },
      },
      {
        key: "rider",
        header: "Rider",
        cell: (row) =>
          row.status === "cancelled" ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : row.riderAssigned ? (
            <div className="flex items-center gap-1.5">
              <Bike className="h-3.5 w-3.5 text-brand" />
              <div>
                <p className="text-sm font-medium">{row.riderName || "Assigned"}</p>
                <p className="text-xs text-muted-foreground">{row.riderCode}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="block text-xs font-medium text-amber-600">Unassigned</span>
              {can("delivery:assign") ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  disabled={assignMut.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    assignMut.mutate(row._id);
                  }}
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" />
                  Assign
                </Button>
              ) : null}
            </div>
          ),
      },
      {
        key: "eta",
        header: "ETA",
        cell: (row) =>
          row.status === "cancelled" ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <span className="text-sm">{formatEta(row)}</span>
          ),
      },
      {
        key: "actions",
        header: "Actions",
        cell: (row) => {
          if (!can("delivery:edit")) {
            return (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(row);
                }}
              >
                View
              </Button>
            );
          }
          const enabled = Boolean(row.canCancel) && !cancelMut.isPending;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => openDetail(row)}
              >
                View
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-destructive hover:text-destructive disabled:opacity-40"
                disabled={!enabled}
                title={
                  enabled
                    ? "Cancel order"
                    : row.status === "cancelled"
                      ? "Already cancelled"
                      : "Unavailable after rider starts the route"
                }
                onClick={() => {
                  if (
                    !window.confirm(
                      `Cancel order ${row.saleNumber}? Stock will be restored. This is only allowed before the rider starts the route.`
                    )
                  ) {
                    return;
                  }
                  cancelMut.mutate(row._id);
                }}
              >
                <Ban className="mr-1 h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          );
        },
      },
    ],
    [assignMut, cancelMut, can]
  );

  return (
    <div>
      <PageHeader
        title="App Orders"
        description="Orders from the customer store app — riders of the branch are auto-assigned"
        breadcrumbs={[
          { label: "Supply", href: "/supply" },
          { label: "App Orders" },
        ]}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search sale number…"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={deliveryStatus}
            onChange={(e) => {
              setDeliveryStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by delivery status"
            placeholder="All delivery statuses"
            options={[
              { value: "scheduled", label: "Scheduled" },
              { value: "pending_assignment", label: "Pending assignment" },
              { value: "in_transit", label: "In transit" },
              { value: "completed", label: "Completed" },
              { value: "refused", label: "Refused" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </div>
      </div>

      {!isLoading && orders.length === 0 ? (
        <EmptyState
          title="No app orders yet"
          description="When customers checkout on the store app, orders appear here and are assigned to branch riders automatically."
        />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          loading={isLoading}
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          onPageChange={setPage}
          onRowClick={openDetail}
        />
      )}

      <AppOrderDetailModal
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedOrder(null);
        }}
      />
    </div>
  );
}
