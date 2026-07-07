"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Printer, Route, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { deliveryApi } from "@/lib/api/deliveries";
import { riderApi } from "@/lib/api/riders";
import { printDeliveryNote } from "@/lib/pdf/delivery-note";
import type { Delivery } from "@/types/delivery";

function refName(ref: string | { name?: string; phone?: string; riderCode?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.phone ?? ref.riderCode ?? "—";
}

function formatSlot(d: Delivery) {
  if (!d.timeSlotStart || !d.timeSlotEnd) return "—";
  return `${new Date(d.timeSlotStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(d.timeSlotEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function DeliveriesPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Delivery | null>(null);
  const [assignRiderId, setAssignRiderId] = useState("");
  const scheduledDate = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["deliveries", page, search, status],
    queryFn: () =>
      deliveryApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
        scheduledDate,
      }),
    enabled: !!user,
  });

  const { data: ridersData } = useQuery({
    queryKey: ["riders-assign", activeBranchId],
    queryFn: () => riderApi.list({ limit: 100, branchId: activeBranchId || undefined }),
    enabled: !!user && assignOpen,
  });

  const whatsappMut = useMutation({
    mutationFn: (id: string) => deliveryApi.sendWhatsApp(id),
    onSuccess: (res) => {
      window.open(res.whatsappLink, "_blank");
      toast.success("WhatsApp opened for rider");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoAssignMut = useMutation({
    mutationFn: (id: string) => deliveryApi.autoAssign(id),
    onSuccess: () => {
      toast.success("Rider assigned automatically");
      void qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMut = useMutation({
    mutationFn: () => {
      if (!assignTarget || !assignRiderId) throw new Error("Select a rider");
      const slotStart = assignTarget.promisedWindowStart ?? assignTarget.timeSlotStart ?? new Date().toISOString();
      const slotEnd = assignTarget.promisedWindowEnd ?? assignTarget.timeSlotEnd ?? new Date().toISOString();
      return deliveryApi.assign(assignTarget._id, {
        riderId: assignRiderId,
        scheduledDate: assignTarget.scheduledDate ?? slotStart,
        timeSlotStart: slotStart,
        timeSlotEnd: slotEnd,
      });
    },
    onSuccess: () => {
      toast.success("Rider assigned");
      setAssignOpen(false);
      setAssignTarget(null);
      setAssignRiderId("");
      void qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const optimizeMut = useMutation({
    mutationFn: async (d: Delivery) => {
      const rider = d.riderId;
      if (!rider || typeof rider === "string") throw new Error("No rider assigned");
      const all = await deliveryApi.list({
        riderId: rider._id,
        scheduledDate,
        status: "scheduled",
        limit: 50,
      });
      return deliveryApi.optimizeRoute(
        rider._id,
        scheduledDate,
        all.data.map((x) => x._id)
      );
    },
    onSuccess: () => {
      toast.success("Route optimized");
      void qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAssign = (d: Delivery) => {
    setAssignTarget(d);
    setAssignRiderId(typeof d.riderId === "object" ? d.riderId._id : d.riderId ?? "");
    setAssignOpen(true);
  };

  const columns: Column<Delivery>[] = [
    { key: "num", header: "#", cell: (d) => d.deliveryNumber },
    { key: "customer", header: "Customer", cell: (d) => refName(d.customerId) },
    {
      key: "sale",
      header: "Sale",
      cell: (d) => (typeof d.saleId === "object" ? d.saleId.saleNumber : "—"),
    },
    { key: "area", header: "Area", cell: (d) => d.area ?? "—" },
    {
      key: "rider",
      header: "Rider",
      cell: (d) =>
        d.riderId ? (
          <span className="font-mono text-xs">{refName(d.riderId)}</span>
        ) : (
          <span className="text-xs text-amber-600">Unassigned</span>
        ),
    },
    { key: "slot", header: "Time slot", cell: (d) => formatSlot(d) },
    { key: "route", header: "Stop #", cell: (d) => (d.routeOrder ? String(d.routeOrder) : "—") },
    { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
    {
      key: "actions",
      header: "",
      cell: (d) => (
        <div className="flex gap-1">
          {can("delivery:assign") && !d.riderId ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                title="Auto-assign best available rider"
                disabled={autoAssignMut.isPending}
                onClick={() => autoAssignMut.mutate(d._id)}
              >
                Auto
              </Button>
              <Button size="sm" variant="ghost" title="Assign rider manually" onClick={() => openAssign(d)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          {d.status !== "pending_assignment" || d.riderId ? (
            <>
              <Button size="sm" variant="ghost" title="Print delivery note" onClick={() => printDeliveryNote(d)}>
                <Printer className="h-4 w-4" />
              </Button>
              {can("delivery:assign") && d.riderId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Send to rider via WhatsApp"
                  onClick={() => whatsappMut.mutate(d._id)}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              ) : null}
              {can("delivery:assign") && d.riderId && d.status === "scheduled" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Optimize route"
                  onClick={() => optimizeMut.mutate(d)}
                >
                  <Route className="h-4 w-4" />
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries"
        description="Today's delivery schedule. Orders auto-assign to riders when available; use Auto or Assign if unassigned."
      />

      <div className="flex flex-wrap gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search deliveries…" />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "", label: "All statuses" },
            { value: "pending_assignment", label: "Pending" },
            { value: "scheduled", label: "Scheduled" },
            { value: "in_transit", label: "In transit" },
            { value: "delivered", label: "Delivered" },
            { value: "failed", label: "Failed" },
          ]}
          className="w-44"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
        emptyDescription="No deliveries for today"
      />

      <Modal open={assignOpen} onOpenChange={setAssignOpen} title="Assign Rider">
        {assignTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {assignTarget.deliveryNumber} · {refName(assignTarget.customerId)} · {formatSlot(assignTarget)}
            </p>
            <div>
              <Label>Rider</Label>
              <Select
                value={assignRiderId}
                onChange={(e) => setAssignRiderId(e.target.value)}
                placeholder="Select rider"
                options={(ridersData?.data ?? []).map((r) => ({
                  value: r._id,
                  label: `${r.riderCode} (${r.status})`,
                }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button disabled={!assignRiderId || assignMut.isPending} onClick={() => assignMut.mutate()}>
                Assign Rider
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
