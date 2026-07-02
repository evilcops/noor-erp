"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks";
import { customerApi } from "@/lib/api/customers";
import { SaleDetailModal } from "@/components/features/orders/SaleDetailModal";
import type { Customer, CustomerDetail, Sale } from "@/types/customer";

function refName(ref: string | { name?: string; sku?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.sku ?? "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatAmount(value?: number) {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(3)} OMR`;
}

export function CustomersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [saleDetailOpen, setSaleDetailOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", page, search],
    queryFn: () => customerApi.list({ page, limit: 20, search: search || undefined }),
    enabled: !!user,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["customer", selectedId],
    queryFn: () => customerApi.get(selectedId!),
    enabled: !!selectedId && detailOpen,
  });

  const openDetail = (customer: Customer) => {
    setSelectedId(customer._id);
    setDetailOpen(true);
  };

  const openSaleDetail = (sale: Sale) => {
    setSelectedSaleId(sale._id);
    setSaleDetailOpen(true);
  };

  const columns: Column<Customer>[] = useMemo(
    () => [
      { key: "name", header: "Customer", cell: (r) => <span className="font-medium">{r.name || "—"}</span> },
      { key: "phone", header: "Phone", cell: (r) => r.phone },
      { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
      { key: "purchases", header: "Purchases", cell: (r) => r.totalPurchases ?? 0 },
      { key: "spent", header: "Total Spent", cell: (r) => formatAmount(r.totalSpent) },
      { key: "last", header: "Last Purchase", cell: (r) => formatDate(r.lastPurchaseAt) },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <Button variant="ghost" size="icon" onClick={() => openDetail(r)} aria-label="View customer">
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const saleColumns: Column<Sale>[] = useMemo(
    () => [
      { key: "saleNumber", header: "Sale #", cell: (r) => r.saleNumber },
      { key: "product", header: "Product", cell: (r) => refName(r.productId) },
      {
        key: "sku",
        header: "SKU",
        cell: (r) => (typeof r.productId === "object" ? r.productId.sku : "—"),
      },
      { key: "branch", header: "Branch", cell: (r) => refName(r.branchId) },
      { key: "qty", header: "Qty", cell: (r) => r.quantity },
      { key: "total", header: "Total", cell: (r) => formatAmount(r.totalAmount) },
      { key: "date", header: "Date", cell: (r) => formatDate(r.createdAt) },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <Button variant="ghost" size="icon" onClick={() => openSaleDetail(r)} aria-label="View sale">
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const customer = detail as CustomerDetail | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer profiles and purchase history from inventory sales"
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone, or email..." className="max-w-xs" />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
      />

      <Modal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedId(null);
        }}
        title="Customer Details"
        size="lg"
      >
        {detailLoading || !customer ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{customer.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{customer.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{customer.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="font-medium">{formatAmount(customer.totalSpent)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="font-medium">{customer.totalPurchases ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Purchase</p>
                <p className="font-medium">{formatDate(customer.lastPurchaseAt)}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">Purchase History</h3>
              <p className="mb-2 text-xs text-muted-foreground">Click the eye icon on an order to view full details.</p>
              <DataTable columns={saleColumns} data={customer.sales ?? []} loading={false} />
            </div>
          </div>
        )}
      </Modal>

      <SaleDetailModal
        saleId={selectedSaleId}
        open={saleDetailOpen}
        onOpenChange={(open) => {
          setSaleDetailOpen(open);
          if (!open) setSelectedSaleId(null);
        }}
      />
    </div>
  );
}
