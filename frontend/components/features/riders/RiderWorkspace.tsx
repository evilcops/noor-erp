"use client";

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
import { riderApi } from "@/lib/api/riders";
import type { Delivery } from "@/types/delivery";

function refName(ref: string | { name?: string; phone?: string; address?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? ref.phone ?? "—";
}

function navUrl(d: Delivery) {
  const c = d.coordinates;
  if (c?.lat) return `https://www.openstreetmap.org/directions?to=${c.lat},${c.lng}`;
  const customer = typeof d.customerId === "object" ? d.customerId.address : "";
  if (customer) return `https://www.openstreetmap.org/search?query=${encodeURIComponent(customer)}`;
  return null;
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-deliveries"],
    queryFn: () => deliveryApi.myDeliveries(),
    refetchInterval: 60000,
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
    onSuccess: () => {
      toast.success("Route started — follow your assigned stops");
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
    onSuccess: () => {
      toast.success("Returning to warehouse");
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
  const nextStop = deliveries.find((d) => d.status === "scheduled" || d.status === "in_transit");

  useEffect(() => {
    if (notesOpen) {
      setActualTime(new Date());
    }
  }, [notesOpen]);

  useEffect(() => {
    if (!rider?.isOnJourney || !rider._id) {
      if (locationInterval.current) clearInterval(locationInterval.current);
      return;
    }

    const tick = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void riderApi.updateLocation(rider._id, pos.coords.latitude, pos.coords.longitude);
        },
        () => undefined,
        { enableHighAccuracy: true }
      );
    };

    tick();
    locationInterval.current = setInterval(tick, 30000);
    return () => {
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, [rider?.isOnJourney, rider?._id]);

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
        description="The dispatch engine assigns your route — start shift, then start route when loaded"
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
              <Button className="flex-1" onClick={() => startRouteMut.mutate()} disabled={startRouteMut.isPending}>
                <Navigation className="mr-2 h-4 w-4" />
                Start Route
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

      {nextStop ? (
        <div className="rounded-lg border-2 border-brand bg-brand/5 p-4">
          <p className="text-xs font-medium uppercase text-brand">Next stop</p>
          <p className="text-lg font-semibold">{refName(nextStop.customerId)}</p>
          <p className="text-sm text-muted-foreground">
            {nextStop.deliveryAddress ?? nextStop.area ?? "No address"}
          </p>
          {navUrl(nextStop) ? (
            <a
              href={navUrl(nextStop)!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Navigate
            </a>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No active stops — waiting for dispatch assignments.</p>
      )}

      <div className="space-y-3">
        {deliveries.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No deliveries assigned for today.
          </p>
        ) : (
          deliveries.map((d) => (
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
