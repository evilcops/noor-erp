"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { refusedItemsApi, type RefusedItem } from "@/lib/api/refused-items";

function productLabel(item: RefusedItem) {
  const p = item.productId;
  if (!p || typeof p === "string") return "—";
  return p.name || p.sku || "—";
}

function productSku(item: RefusedItem) {
  const p = item.productId;
  if (!p || typeof p === "string") return "—";
  return p.sku || "—";
}

function branchLabel(item: RefusedItem) {
  const b = item.branchId;
  if (!b || typeof b === "string") return "—";
  return b.name || b.code || "—";
}

function riderLabel(item: RefusedItem) {
  const r = item.riderId;
  if (!r || typeof r === "string") return "—";
  const emp = r.employeeId;
  if (emp && typeof emp === "object") {
    const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ").trim();
    if (name) return name;
  }
  return r.riderCode || "—";
}

export function RefusedItemsPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("at_warehouse");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["refused-items", page, search, status, activeBranchId],
    queryFn: () =>
      refusedItemsApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
        branchId: activeBranchId || undefined,
      }),
    enabled: !!user,
  });

  const restockMut = useMutation({
    mutationFn: (id: string) => refusedItemsApi.restock(id),
    onSuccess: () => {
      toast.success("Product restocked into warehouse");
      void qc.invalidateQueries({ queryKey: ["refused-items"] });
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discardMut = useMutation({
    mutationFn: (id: string) => refusedItemsApi.discard(id),
    onSuccess: () => {
      toast.success("Item discarded");
      void qc.invalidateQueries({ queryKey: ["refused-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.data ?? [];

  const columns: Column<RefusedItem>[] = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        cell: (row) => (
          <div>
            <p className="font-medium">{productLabel(row)}</p>
            <p className="text-xs text-muted-foreground">{productSku(row)}</p>
          </div>
        ),
      },
      {
        key: "qty",
        header: "Qty",
        cell: (row) => <span className="font-semibold">{row.quantity}</span>,
      },
      {
        key: "order",
        header: "Order / Delivery",
        cell: (row) => (
          <div>
            <p className="text-sm">{row.saleNumber || "—"}</p>
            <p className="text-xs text-muted-foreground">{row.deliveryNumber || "—"}</p>
          </div>
        ),
      },
      {
        key: "branch",
        header: "Branch",
        cell: (row) => branchLabel(row),
      },
      {
        key: "rider",
        header: "Rider",
        cell: (row) => riderLabel(row),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "returned",
        header: "Returned",
        cell: (row) =>
          row.returnedAt ? (
            <span className="text-sm">{new Date(row.returnedAt).toLocaleString()}</span>
          ) : (
            <span className="text-xs text-muted-foreground">With rider</span>
          ),
      },
      {
        key: "actions",
        header: "Actions",
        cell: (row) => {
          if (!can("inventory:edit")) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          if (row.status !== "at_warehouse") {
            return (
              <span className="text-xs text-muted-foreground">
                {row.status === "with_rider" ? "Waiting for warehouse return" : "—"}
              </span>
            );
          }
          return (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={restockMut.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Restock ${row.quantity}× ${productLabel(row)} into warehouse inventory?`
                    )
                  ) {
                    return;
                  }
                  restockMut.mutate(row._id);
                }}
              >
                <PackageCheck className="mr-1 h-3.5 w-3.5" />
                Restock
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={discardMut.isPending}
                onClick={() => {
                  if (!window.confirm("Discard this refused item without restocking?")) return;
                  discardMut.mutate(row._id);
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Discard
              </Button>
            </div>
          );
        },
      },
    ],
    [can, discardMut, restockMut]
  );

  return (
    <div>
      <PageHeader
        title="Refused Items"
        description="Products refused by customers and returned by riders — review and restock into warehouse"
        breadcrumbs={[
          { label: "Supply", href: "/supply" },
          { label: "Refused Items" },
        ]}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search sale / delivery…"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "at_warehouse", label: "At warehouse" },
            { value: "with_rider", label: "With rider" },
            { value: "restocked", label: "Restocked" },
            { value: "discarded", label: "Discarded" },
          ]}
          className="w-44"
        />
      </div>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          title="No refused items"
          description="When a rider marks an order refused and returns to warehouse, products appear here for restock."
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={isLoading}
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
