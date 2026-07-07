"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Package, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { deliveryApi } from "@/lib/api/deliveries";
import { clusterApi } from "@/lib/api/clusters";
import { clusterZoneSummary } from "@/components/features/clusters/ClusterZonesLayer";
import { riderApi } from "@/lib/api/riders";
import { printDeliveryNote } from "@/lib/pdf/delivery-note";
import type { Delivery, WarehouseStatus } from "@/types/delivery";

const DeliveryMap = dynamic(
  () => import("./DeliveryMap").then((m) => m.DeliveryMap),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-lg bg-muted" /> }
);

function refName(ref: string | { name?: string; phone?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.phone ?? "—";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatPromiseWindow(start?: string, end?: string) {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const WAREHOUSE_NEXT: Partial<Record<WarehouseStatus, WarehouseStatus>> = {
  order_confirmed: "picking",
  picking: "packing",
  packing: "ready_for_dispatch",
  ready_for_dispatch: "waiting_for_rider",
  waiting_for_rider: "loaded",
  loaded: "dispatched",
};

const WAREHOUSE_LABELS: Record<string, string> = {
  order_confirmed: "Start Picking",
  picking: "Start Packing",
  packing: "Ready for Dispatch",
  ready_for_dispatch: "Waiting for Rider",
  waiting_for_rider: "Mark Loaded",
  loaded: "Dispatch",
};

const ORDER_SOURCE_LABELS: Record<string, string> = {
  new_order: "New",
  previous_day: "Previous Day",
  standing_daily: "Daily Standing",
  standing_weekly: "Weekly",
  standing_fortnightly: "Fortnightly",
  scheduled: "Scheduled",
  replenishment: "Replenishment",
  back_order: "Back Order",
};

function clusterLabel(d: Delivery) {
  const c = d.clusterId;
  if (!c) return "—";
  if (typeof c === "object" && c && "code" in c) return (c as { code?: string }).code ?? "—";
  return String(c);
}

export function DispatchPage() {
  const { user } = useAuth();
  const { mainBranches, activeMainBranchId } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [riderId, setRiderId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(todayIso());
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("10:00");
  const [priority, setPriority] = useState("normal");
  const [mapMainBranchId, setMapMainBranchId] = useState("");

  useEffect(() => {
    if (mapMainBranchId) return;
    const defaultId =
      activeMainBranchId && mainBranches.some((b) => b._id === activeMainBranchId)
        ? activeMainBranchId
        : mainBranches[0]?._id ?? "";
    if (defaultId) setMapMainBranchId(defaultId);
  }, [activeMainBranchId, mainBranches, mapMainBranchId]);

  const branchId = mapMainBranchId || user?.branchId || "";

  const selectedMainBranch = useMemo(
    () => mainBranches.find((b) => b._id === mapMainBranchId),
    [mainBranches, mapMainBranchId]
  );

  const { data: branchClusters } = useQuery({
    queryKey: ["dispatch-clusters", mapMainBranchId],
    queryFn: () => clusterApi.list({ branchId: mapMainBranchId, limit: 20 }),
    enabled: !!mapMainBranchId,
  });

  const warehousePoint = useMemo(() => {
    const coords = selectedMainBranch?.gpsCoordinates;
    if (!coords?.lat) return { lat: 23.588, lng: 58.3829, label: "Warehouse" };
    return {
      lat: coords.lat,
      lng: coords.lng,
      label: `${selectedMainBranch?.name ?? "Warehouse"}`,
    };
  }, [selectedMainBranch]);

  const { data: dashboard } = useQuery({
    queryKey: ["dispatch-dashboard"],
    queryFn: () => deliveryApi.dashboard(),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: liveRiders } = useQuery({
    queryKey: ["riders-live", branchId],
    queryFn: () => riderApi.live(branchId),
    enabled: !!user && !!branchId,
    refetchInterval: 15000,
  });

  const { data: riders } = useQuery({
    queryKey: ["riders-list"],
    queryFn: () => riderApi.list({ limit: 100, status: "active" }),
    enabled: !!user && assignOpen,
  });

  const { data: demandQueue } = useQuery({
    queryKey: ["dispatch-queue", branchId],
    queryFn: () => deliveryApi.demandQueue(branchId),
    enabled: !!user && !!branchId,
    refetchInterval: 30000,
  });

  const { data: fleetSnapshot } = useQuery({
    queryKey: ["dispatch-snapshot", branchId],
    queryFn: () => deliveryApi.fleetSnapshot(branchId),
    enabled: !!user && !!branchId,
    refetchInterval: 30000,
  });

  const standingMut = useMutation({
    mutationFn: () => deliveryApi.processStandingOrders(branchId),
    onSuccess: (res) => {
      toast.success(`Processed ${res.processed} standing order(s)`);
      void qc.invalidateQueries({ queryKey: ["dispatch-queue"] });
      void qc.invalidateQueries({ queryKey: ["dispatch-snapshot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fleetOptimiseMut = useMutation({
    mutationFn: () => deliveryApi.optimiseFleet(branchId),
    onSuccess: (res) => {
      const count = res.optimised?.length ?? 0;
      toast.success(`Fleet optimised — ${count} run(s) updated`);
      void qc.invalidateQueries({ queryKey: ["dispatch-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["dispatch-queue"] });
      void qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const warehouseMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      deliveryApi.warehouseStatus(id, status),
    onSuccess: () => {
      toast.success("Warehouse status updated");
      void qc.invalidateQueries({ queryKey: ["dispatch-queue"] });
      void qc.invalidateQueries({ queryKey: ["dispatch-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No delivery");
      const start = new Date(`${scheduledDate}T${slotStart}:00`);
      const end = new Date(`${scheduledDate}T${slotEnd}:00`);
      return deliveryApi.assign(selected._id, {
        riderId,
        scheduledDate,
        timeSlotStart: start.toISOString(),
        timeSlotEnd: end.toISOString(),
        priority: priority as Delivery["priority"],
      });
    },
    onSuccess: () => {
      toast.success("Delivery assigned");
      setAssignOpen(false);
      void qc.invalidateQueries({ queryKey: ["dispatch-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const whatsappMut = useMutation({
    mutationFn: (id: string) => deliveryApi.sendWhatsApp(id),
    onSuccess: (res) => {
      window.open(res.whatsappLink, "_blank");
      toast.success("WhatsApp opened");
      void qc.invalidateQueries({ queryKey: ["dispatch-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const optimizeMut = useMutation({
    mutationFn: async (delivery: Delivery) => {
      if (!delivery.riderId || typeof delivery.riderId === "string") {
        throw new Error("Assign a rider first");
      }
      const riderDeliveries = await deliveryApi.list({
        riderId: delivery.riderId._id,
        scheduledDate,
        status: "scheduled",
        limit: 50,
      });
      const ids = riderDeliveries.data.map((d) => d._id);
      if (!ids.length) throw new Error("No scheduled deliveries to optimize");
      return deliveryApi.optimizeRoute(delivery.riderId._id, scheduledDate, ids);
    },
    onSuccess: () => {
      toast.success("Route optimized");
      void qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = dashboard?.stats;
  const pending = dashboard?.recentPending ?? [];
  const queue = demandQueue ?? [];

  const mapDeliveries = useMemo(
    () => [...pending, ...queue].filter((d) => d.coordinates?.lat),
    [pending, queue]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description="Warehouse demand queue, delivery promises, and fleet optimisation"
        actions={
          can("delivery:assign") && branchId ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => standingMut.mutate()}
                disabled={standingMut.isPending}
              >
                Process Standing Orders
              </Button>
              <Button
                variant="secondary"
                onClick={() => fleetOptimiseMut.mutate()}
                disabled={fleetOptimiseMut.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${fleetOptimiseMut.isPending ? "animate-spin" : ""}`} />
                Optimise Fleet
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Queue Total", value: fleetSnapshot?.demandQueueTotal ?? queue.length, color: "text-foreground" },
          { label: "Pending", value: stats?.pending ?? 0, color: "text-amber-600" },
          { label: "Scheduled", value: stats?.scheduled ?? 0, color: "text-blue-600" },
          { label: "In Transit", value: stats?.inTransit ?? 0, color: "text-indigo-600" },
          { label: "Active Riders", value: stats?.activeRiders ?? 0, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {fleetSnapshot ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">Demand by Cluster</h3>
            <div className="space-y-2">
              {(fleetSnapshot.byCluster ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No cluster demand</p>
              ) : (
                fleetSnapshot.byCluster.map((c) => (
                  <div key={c.clusterId} className="flex justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span className="font-medium">Cluster {c.code}</span>
                    <span className="text-muted-foreground">
                      {c.count} orders · {c.totalValue.toFixed(0)} value
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">Active Delivery Runs</h3>
            <div className="space-y-2">
              {(fleetSnapshot.activeRuns ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active runs — click Optimise Fleet</p>
              ) : (
                fleetSnapshot.activeRuns.map((run) => (
                  <div key={run.runId} className="rounded-md border border-border px-3 py-2 text-sm">
                    <p className="font-medium">
                      {run.riderCode} · {run.runNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.stops} stops
                      {run.deliveriesPerKm ? ` · ${run.deliveriesPerKm.toFixed(1)} del/km` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px]">
            <Label>Main branch</Label>
            <Select
              value={mapMainBranchId}
              onChange={(e) => setMapMainBranchId(e.target.value)}
              options={mainBranches.map((b) => ({ value: b._id, label: b.name }))}
              placeholder="Select main branch"
            />
          </div>
          {branchClusters?.data?.length ? (
            <p className="text-xs text-muted-foreground pb-2">
              {clusterZoneSummary(branchClusters.data)}
            </p>
          ) : mapMainBranchId ? (
            <p className="text-xs text-amber-600 pb-2">
              No clusters for this branch — create a main branch with a map location to auto-generate zones
            </p>
          ) : null}
        </div>

        <DeliveryMap
          focusKey={mapMainBranchId}
          center={warehousePoint}
          warehouse={warehousePoint}
          clusters={branchClusters?.data ?? []}
          riders={liveRiders ?? []}
          deliveries={mapDeliveries}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Warehouse Demand Queue
          </h2>
          <p className="text-xs text-muted-foreground">
            All due orders share one queue — advance through picking, packing, and dispatch
          </p>
        </div>
        <div className="divide-y divide-border">
          {queue.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No orders in warehouse queue</p>
          ) : (
            queue.map((d) => {
              const ws = d.warehouseStatus ?? "order_confirmed";
              const nextStatus = WAREHOUSE_NEXT[ws];
              return (
                <div key={d._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{d.deliveryNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {refName(d.customerId)} ·{" "}
                      {typeof d.saleId === "object" ? d.saleId.saleNumber : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ORDER_SOURCE_LABELS[d.orderSource ?? "new_order"] ?? d.orderSource} · Cluster {clusterLabel(d)}
                      {" · "}
                      Promise: {formatPromiseWindow(d.promisedWindowStart, d.promisedWindowEnd)}
                      {d.queuePosition ? ` · Queue #${d.queuePosition}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={ws} />
                    {nextStatus && can("delivery:assign") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={warehouseMut.isPending}
                        onClick={() => warehouseMut.mutate({ id: d._id, status: nextStatus })}
                      >
                        {WAREHOUSE_LABELS[ws] ?? "Advance"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">Pending Assignments</h2>
          <p className="text-xs text-muted-foreground">Sorted by priority score</p>
        </div>
        <div className="divide-y divide-border">
          {pending.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No pending deliveries</p>
          ) : (
            pending.map((d) => (
              <div key={d._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{d.deliveryNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {refName(d.customerId)} ·{" "}
                    {typeof d.saleId === "object" ? d.saleId.saleNumber : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.area ?? d.deliveryAddress ?? "No address"} · Score {d.priorityScore}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={d.status} />
                  {can("delivery:assign") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(d);
                        setAssignOpen(true);
                      }}
                    >
                      <MapPin className="mr-1 h-3.5 w-3.5" />
                      Assign
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={assignOpen} onOpenChange={setAssignOpen} title="Assign Delivery">
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{selected.deliveryNumber}</strong> — {refName(selected.customerId)}
            </p>
            <div>
              <Label>Rider</Label>
              <Select
                value={riderId}
                onChange={(e) => setRiderId(e.target.value)}
                options={(riders?.data ?? []).map((r) => {
                  const emp = r.employeeId;
                  const name =
                    typeof emp === "object" ? `${emp.firstName} ${emp.lastName}` : r.riderCode;
                  return { value: r._id, label: `${name} (${r.riderCode})` };
                })}
                placeholder="Select rider"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Date</Label>
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "normal", label: "Normal" },
                    { value: "high", label: "High" },
                    { value: "urgent", label: "Urgent" },
                  ]}
                />
              </div>
              <div>
                <Label>Slot start</Label>
                <Input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
              </div>
              <div>
                <Label>Slot end</Label>
                <Input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!riderId || assignMut.isPending} onClick={() => assignMut.mutate()}>
                Assign
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
