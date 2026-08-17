"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Fuel } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useAuth, useBranch } from "@/hooks";
import { riderApi } from "@/lib/api/riders";
import type { Delivery } from "@/types/delivery";
import type { Rider } from "@/types/rider";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateRange(from: string, to: string) {
  if (from === to) return formatDisplayDate(from);
  return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
}

function empName(rider: Rider) {
  const emp = rider.employeeId;
  if (typeof emp === "object") return `${emp.firstName} ${emp.lastName}`;
  return rider.riderCode;
}

function refName(ref: string | { name?: string; phone?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.phone ?? "—";
}

function formatSlot(d: Delivery) {
  if (!d.timeSlotStart || !d.timeSlotEnd) return "—";
  return `${new Date(d.timeSlotStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(d.timeSlotEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return new Date(iso).toLocaleDateString();
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number) {
  return `Rs ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RiderHistoryPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [riderId, setRiderId] = useState("");
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [fuelPriceOpen, setFuelPriceOpen] = useState(false);
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState("");

  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["riders-history-select", activeBranchId],
    queryFn: () => riderApi.list({ limit: 200, branchId: activeBranchId || undefined }),
    enabled: !!user,
  });

  const riders = ridersData?.data ?? [];

  useEffect(() => {
    if (riderId || !riders.length) return;
    setRiderId(riders[0]._id);
  }, [riders, riderId]);

  useEffect(() => {
    setPage(1);
  }, [riderId, dateFrom, dateTo, status]);

  const { data, isLoading } = useQuery({
    queryKey: ["rider-history", riderId, dateFrom, dateTo, status, page],
    queryFn: () =>
      riderApi.history(riderId, {
        page,
        limit: 20,
        dateFrom,
        dateTo,
        status: status || undefined,
      }),
    enabled: !!user && !!riderId && dateFrom <= dateTo,
  });

  const history = data?.data;
  const summary = history?.summary;
  const deliveries = history?.deliveries ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const liters = summary?.fuelLitersConsumed ?? 0;
  const pricePerLiter = Number(fuelPricePerLiter);
  const fuelCost =
    Number.isFinite(pricePerLiter) && pricePerLiter > 0 ? liters * pricePerLiter : null;

  const riderOptions = useMemo(
    () =>
      riders.map((r) => ({
        value: r._id,
        label: `${empName(r)} (${r.riderCode})`,
      })),
    [riders]
  );

  const selectedRider = riders.find((r) => r._id === riderId);

  const columns: Column<Delivery>[] = [
    { key: "num", header: "#", cell: (d) => d.deliveryNumber },
    {
      key: "date",
      header: "Date",
      cell: (d) => formatDate(d.scheduledDate ?? d.promisedWindowStart ?? d.createdAt),
    },
    { key: "customer", header: "Customer", cell: (d) => refName(d.customerId) },
    {
      key: "sale",
      header: "Sale",
      cell: (d) => (typeof d.saleId === "object" ? d.saleId.saleNumber : "—"),
    },
    { key: "area", header: "Area", cell: (d) => d.area ?? "—" },
    { key: "slot", header: "Time slot", cell: (d) => formatSlot(d) },
    { key: "route", header: "Stop #", cell: (d) => (d.routeOrder ? String(d.routeOrder) : "—") },
    { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rider History"
        description="Select a rider to view delivery history and estimated fuel consumption (1 L / 45 km)"
        actions={
          <Button
            type="button"
            onClick={() => setFuelPriceOpen(true)}
            disabled={!riderId || isLoading}
          >
            <Fuel className="mr-2 h-4 w-4" />
            Calculate fuel price
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px]">
          <Label>Rider</Label>
          <Select
            value={riderId}
            onChange={(e) => setRiderId(e.target.value)}
            options={riderOptions}
            placeholder={ridersLoading ? "Loading riders…" : "Select rider"}
            disabled={ridersLoading || !riders.length}
          />
        </div>
        <div>
          <Label>Date from</Label>
          <Input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => {
              const next = e.target.value;
              setDateFrom(next);
              if (next > dateTo) setDateTo(next);
            }}
            className="w-[150px]"
          />
        </div>
        <div>
          <Label>Date to</Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => {
                const next = e.target.value;
                setDateTo(next);
                if (next < dateFrom) setDateFrom(next);
              }}
              className="w-[150px]"
            />
            {dateFrom !== todayIso() || dateTo !== todayIso() ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const today = todayIso();
                  setDateFrom(today);
                  setDateTo(today);
                }}
              >
                Today
              </Button>
            ) : null}
          </div>
        </div>
        <div className="min-w-[160px]">
          <Label>Status</Label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "delivered", label: "Delivered" },
              { value: "in_transit", label: "In transit" },
              { value: "scheduled", label: "Scheduled" },
              { value: "failed", label: "Failed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            placeholder="All statuses"
          />
        </div>
      </div>

      {!riderId ? (
        <EmptyState title="Select a rider" description="Choose a rider to view delivery history and fuel use." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Deliveries</p>
              <p className="text-2xl font-semibold">{summary?.totalDeliveries ?? 0}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {summary?.byStatus?.delivered ?? 0} delivered
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Runs</p>
              <p className="text-2xl font-semibold">{summary?.runCount ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="text-2xl font-semibold">{(summary?.totalDistanceKm ?? 0).toFixed(1)} km</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Fuel consumed</p>
              <p className="text-2xl font-semibold text-amber-700">
                {liters.toFixed(2)} L
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Est. {summary?.kmPerLiter ?? 45} km / liter
              </p>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={deliveries}
            loading={isLoading}
            emptyTitle="No deliveries"
            emptyDescription="No delivery history for this rider in the selected date range."
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        open={fuelPriceOpen}
        onOpenChange={(open) => {
          setFuelPriceOpen(open);
          if (!open) setFuelPricePerLiter("");
        }}
        title="Calculate fuel price"
        description="Enter today's fuel price per liter to estimate cost for the selected period."
        size="sm"
        footer={
          <Button type="button" variant="secondary" onClick={() => setFuelPriceOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Rider:</span>{" "}
              {selectedRider ? empName(selectedRider) : "—"}
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">Period:</span> {formatDateRange(dateFrom, dateTo)}
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">Fuel used:</span> {liters.toFixed(2)} L
              <span className="text-muted-foreground"> · {(summary?.totalDistanceKm ?? 0).toFixed(1)} km</span>
            </p>
          </div>

          <div>
            <Label htmlFor="fuel-price">Today&apos;s fuel price (Rs / liter)</Label>
            <Input
              id="fuel-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g. 275"
              value={fuelPricePerLiter}
              onChange={(e) => setFuelPricePerLiter(e.target.value)}
              autoFocus
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Estimated fuel cost</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">
              {fuelCost != null ? formatMoney(fuelCost) : "—"}
            </p>
            {fuelCost != null ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {liters.toFixed(2)} L × {formatMoney(pricePerLiter)} / L
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">Enter a price to see the total</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
