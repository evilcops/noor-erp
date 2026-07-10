"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  MapPin,
  Navigation,
  Play,
  Square,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { deliveryApi } from "@/lib/api/deliveries";
import { googleMapsRoundTripUrl } from "@/lib/navigation";
import type { Delivery } from "@/types/delivery";
import type { RiderRoutePlan, RiderRouteSummary } from "@/types/rider";

const RiderRouteMap = dynamic(
  () => import("@/components/features/riders/RiderRouteMap").then((m) => m.RiderRouteMap),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-lg bg-muted" /> }
);

function refName(ref: string | { name?: string; phone?: string; address?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.phone ?? "—";
}

function fullRouteNavUrl(route: RiderRoutePlan) {
  return googleMapsRoundTripUrl(route.warehouse, route.stops);
}

function deliveryOrderAmount(d: Delivery | null): string {
  if (!d) return "—";
  const sale = d.saleId;
  if (!sale || typeof sale === "string") return "—";
  return `${sale.totalAmount.toFixed(3)} OMR`;
}

function formatDeliveryWindow(d: Delivery | null): string {
  if (!d) return "—";
  const start = d.promisedWindowStart ?? d.timeSlotStart;
  const end = d.promisedWindowEnd ?? d.timeSlotEnd;
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function summaryToRoutePlan(
  summary: RiderRouteSummary,
  warehouse: { lat: number; lng: number; label?: string }
): RiderRoutePlan {
  return {
    warehouse,
    pathGeometry: summary.pathGeometry,
    stops: summary.points.map((p) => ({
      deliveryId: p.deliveryId ?? "",
      order: p.order,
      lat: p.lat,
      lng: p.lng,
      label: p.label ?? `Stop ${p.order}`,
    })),
    outboundDistanceKm: summary.outboundDistanceKm,
    returnDistanceKm: summary.returnDistanceKm,
    roundTripDistanceKm: summary.roundTripDistanceKm,
    totalDurationMin: summary.totalDurationMin,
    roundTripCost: summary.roundTripCost,
    costPerKm: summary.costPerKm,
    stopCount: summary.stopCount,
  };
}

function formatDateTime(value: Date): string {
  return value.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Logged-in rider's own delivery workspace (start/end journey, complete stops). */
export function RiderWorkspace() {
  const qc = useQueryClient();
  const [notesOpen, setNotesOpen] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [notes, setNotes] = useState("");
  const [cash, setCash] = useState("");
  const [actualTime, setActualTime] = useState<Date | null>(null);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationErrorShown = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-deliveries"],
    queryFn: () => deliveryApi.myDeliveries(),
    refetchInterval: (query) => {
      const rider = query.state.data?.rider;
      if (rider?.isOnShift && !rider.isOnJourney) return 15_000;
      if (rider?.isOnJourney) return 30_000;
      return false;
    },
  });

  const startShiftMut = useMutation({
    mutationFn: () => deliveryApi.startShift(),
    onSuccess: () => {
      toast.success("Shift started");
      void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startRouteMut = useMutation({
    mutationFn: () => deliveryApi.startRoute(),
    onSuccess: (result) => {
      const n = result.stopsDispatched ?? 0;
      toast.success(
        n > 0
          ? `Route started — ${n} stop${n === 1 ? "" : "s"} locked. No new orders will be added.`
          : "Route started — follow your assigned stops"
      );
      void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endShiftMut = useMutation({
    mutationFn: () => deliveryApi.endShift(),
    onSuccess: () => {
      toast.success("Shift ended");
      void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const returnMut = useMutation({
    mutationFn: () => deliveryApi.endJourney(),
    onSuccess: (result) => {
      if (result.assigned && result.assigned > 0) {
        toast.success(result.message ?? `Next route assigned — ${result.assigned} stops`);
      } else {
        toast.success(result.message ?? "Back at warehouse");
      }
      void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (payload: {
      id: string;
      status: string;
      notes?: string;
      cashCollected?: number;
      failureReason?: string;
    }) =>
      deliveryApi.updateStatus(payload.id, {
        status: payload.status,
        notes: payload.notes,
        failureReason: payload.failureReason,
        cashCollected: payload.cashCollected,
        cashHandedOver: payload.status === "delivered" && payload.cashCollected !== undefined,
      }),
    onSuccess: () => {
      toast.success("Updated");
      setNotesOpen(false);
      setActiveDelivery(null);
      void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rider = data?.rider;
  const deliveries = data?.deliveries ?? [];
  const route = data?.route ?? null;
  const previousRoute = data?.previousRoute ?? null;
  const pathSummary = data?.pathSummary ?? null;
  const canAcceptMoreOrders = data?.canAcceptMoreOrders ?? !rider?.isOnJourney;
  const routeNavUrl = route ? fullRouteNavUrl(route) : null;
  const [showPreviousRoute, setShowPreviousRoute] = useState(false);

  useEffect(() => {
    if (notesOpen) {
      setActualTime(new Date());
    }
  }, [notesOpen]);

  useEffect(() => {
    if (!rider?.isOnShift || !rider._id) {
      if (locationInterval.current) clearInterval(locationInterval.current);
      locationErrorShown.current = false;
      return;
    }

    const tick = () => {
      if (!navigator.geolocation) {
        if (!locationErrorShown.current) {
          locationErrorShown.current = true;
          toast.error("Location is not available in this browser");
        }
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void deliveryApi
            .updateMyLocation(pos.coords.latitude, pos.coords.longitude)
            .catch((e: Error) => {
              if (!locationErrorShown.current) {
                locationErrorShown.current = true;
                toast.error(e.message || "Could not send GPS to server");
              }
            });
        },
        (err) => {
          if (!locationErrorShown.current) {
            locationErrorShown.current = true;
            const msg =
              err.code === err.PERMISSION_DENIED
                ? "Allow location permission so dispatch can see you on the map"
                : "Could not read GPS from this device";
            toast.error(msg);
          }
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
      );
    };

    tick();
    locationInterval.current = setInterval(tick, 30000);
    return () => {
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, [rider?.isOnShift, rider?._id]);

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading your deliveries…</p>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="text-muted-foreground">
          Your account is not linked to a rider profile. Contact HR to register you as a rider with a
          login account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="My Deliveries"
        description={
          rider?.isOnJourney
            ? "Route is locked — complete all stops, then return to warehouse."
            : "At warehouse: review the full route, load every order, then start route. Dispatch may add stops until you leave."
        }
      />

      <div className="flex flex-wrap gap-2">
        {!rider?.isOnShift ? (
          <Button className="flex-1" onClick={() => startShiftMut.mutate()} disabled={startShiftMut.isPending}>
            <Play className="mr-2 h-4 w-4" />
            Start Shift
          </Button>
        ) : (
          <>
            {!rider.isOnJourney ? (
              <Button
                className="flex-1"
                onClick={() => startRouteMut.mutate()}
                disabled={startRouteMut.isPending || deliveries.length === 0}
              >
                <Navigation className="mr-2 h-4 w-4" />
                Start Route ({deliveries.length} stops)
              </Button>
            ) : (
              <Button className="flex-1" variant="secondary" onClick={() => returnMut.mutate()} disabled={returnMut.isPending}>
                Return to Warehouse
              </Button>
            )}
            <Button variant="secondary" onClick={() => endShiftMut.mutate()} disabled={endShiftMut.isPending || rider.isOnJourney}>
              <Square className="mr-2 h-4 w-4" />
              End Shift
            </Button>
          </>
        )}
      </div>

      {route ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {rider?.isOnJourney ? "Active route (locked)" : "Pickup route — load all orders first"}
              </p>
              <p className="text-xs text-muted-foreground">
                {route.stopCount} stops · {route.roundTripDistanceKm.toFixed(1)} km round trip · ~
                {route.totalDurationMin} min
                {data?.runNumber ? ` · ${data.runNumber}` : ""}
              </p>
            </div>
            {routeNavUrl ? (
              <a
                href={routeNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Open in Maps
              </a>
            ) : null}
          </div>
          {pathSummary && !rider?.isOnJourney ? (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Full path: </span>
              {pathSummary}
            </p>
          ) : null}
          {!rider?.isOnJourney && canAcceptMoreOrders ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              New orders may still be added to this route while you are at the warehouse. The map updates
              automatically. Once you start route, no more stops are added.
            </p>
          ) : null}
          <RiderRouteMap route={route} showReturnLeg />
          {!rider?.isOnJourney ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-medium">Warehouse pickup list</p>
              <ol className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    W
                  </span>
                  Start at warehouse — collect all orders below
                </li>
                {route.stops.map((stop) => (
                  <li key={stop.deliveryId} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {stop.order}
                    </span>
                    <span>{stop.label}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold">
                    W
                  </span>
                  Return to warehouse after last delivery
                </li>
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      {previousRoute ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowPreviousRoute((v) => !v)}
          >
            <div>
              <p className="font-semibold">Previous route</p>
              <p className="text-xs text-muted-foreground">
                {previousRoute.runNumber ?? "Completed run"} · {previousRoute.stopCount} stops
                {previousRoute.deliveredCount != null
                  ? ` · ${previousRoute.deliveredCount} delivered`
                  : ""}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{showPreviousRoute ? "Hide" : "Show"}</span>
          </button>
          {showPreviousRoute ? (
            <div className="mt-3">
              <RiderRouteMap
                route={summaryToRoutePlan(
                  previousRoute,
                  route?.warehouse ?? { lat: 23.588, lng: 58.3829, label: "Warehouse" }
                )}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {deliveries.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No deliveries assigned for today.
          </p>
        ) : (
          deliveries
            .slice()
            .sort((a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999))
            .map((d) => (
            <div key={d._id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    #{d.routeOrder ?? "—"} {refName(d.customerId)}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.deliveryNumber}</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                {d.deliveryAddress ?? d.area ?? "—"}
              </p>
              {d.status === "scheduled" || d.status === "in_transit" ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button
                    variant="secondary"
                    onClick={() => statusMut.mutate({ id: d._id, status: "in_transit" })}
                  >
                    En route
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setActiveDelivery(d);
                      setCash("");
                      setNotes("");
                      setNotesOpen(true);
                    }}
                  >
                    <CheckCircle className="mr-1 h-3.5 w-3.5" />
                    Delivered
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      statusMut.mutate({
                        id: d._id,
                        status: "failed",
                        failureReason: "customer_unavailable",
                        notes: "Customer unavailable",
                      })
                    }
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    Unavailable
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      statusMut.mutate({ id: d._id, status: "refused", notes: "Customer refused" })
                    }
                  >
                    Refused
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <Modal open={notesOpen} onOpenChange={setNotesOpen} title="Complete delivery">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Order price</Label>
              <Input readOnly value={deliveryOrderAmount(activeDelivery)} className="bg-muted" />
            </div>
            <div>
              <Label>Time to delivery</Label>
              <Input readOnly value={formatDeliveryWindow(activeDelivery)} className="bg-muted" />
            </div>
          </div>
          <div>
            <Label>Actual delivery time</Label>
            <Input
              readOnly
              value={actualTime ? formatDateTime(actualTime) : "—"}
              className="bg-muted"
            />
          </div>
          <div>
            <Label>Collected amount (OMR)</Label>
            <Input
              type="number"
              step="0.001"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="0.000"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (!activeDelivery) return;
              statusMut.mutate({
                id: activeDelivery._id,
                status: "delivered",
                notes,
                cashCollected: cash ? Number(cash) : undefined,
              });
            }}
          >
            Confirm delivered
          </Button>
        </div>
      </Modal>
    </div>
  );
}
