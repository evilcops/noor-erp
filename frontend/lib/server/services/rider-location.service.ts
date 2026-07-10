import type { Types } from "mongoose";
import { Delivery } from "../models/Delivery.model";
import type { IDeliveryRun } from "../models/DeliveryRun.model";
import { planRoadRouteRoundTrip } from "./route-optimization.service";

export interface RiderRouteSummary {
  runId?: string;
  runNumber?: string;
  runStatus?: "planning" | "loading" | "active" | "completed";
  completedAt?: Date;
  startedAt?: Date;
  estimatedReturnAt?: Date;
  points: {
    lat: number;
    lng: number;
    order: number;
    deliveryId?: string;
    label?: string;
    deliveryStatus?: string;
  }[];
  pathGeometry: { lat: number; lng: number }[];
  outboundDistanceKm: number;
  returnDistanceKm: number;
  roundTripDistanceKm: number;
  totalDurationMin: number;
  roundTripCost: number;
  costPerKm: number;
  stopCount: number;
  deliveredCount?: number;
}

type DeliveryWithCustomer = {
  _id: Types.ObjectId | string;
  coordinates?: { lat?: number; lng?: number };
  routeOrder?: number;
  status?: string;
  customerId?: { name?: string; phone?: string } | Types.ObjectId;
};

export async function buildRouteSummaryFromDeliveries(
  origin: { lat: number; lng: number },
  deliveries: DeliveryWithCustomer[],
  meta?: {
    runId?: string;
    runNumber?: string;
    runStatus?: RiderRouteSummary["runStatus"];
    completedAt?: Date;
    startedAt?: Date;
    estimatedReturnAt?: Date;
  }
): Promise<RiderRouteSummary | null> {
  const ordered = [...deliveries]
    .filter((d) => d.coordinates?.lat != null && d.coordinates?.lng != null)
    .sort((a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999));

  if (!ordered.length) return null;

  const stops = ordered.map((d) => ({
    id: String(d._id),
    lat: d.coordinates!.lat!,
    lng: d.coordinates!.lng!,
  }));

  const { optimized, road } = await planRoadRouteRoundTrip(origin, stops);
  const deliveredCount = ordered.filter((d) => d.status === "delivered").length;

  return {
    runId: meta?.runId,
    runNumber: meta?.runNumber,
    runStatus: meta?.runStatus,
    completedAt: meta?.completedAt,
    startedAt: meta?.startedAt,
    estimatedReturnAt: meta?.estimatedReturnAt,
    points: optimized.stops.map((s, i) => {
      const del = ordered.find((d) => String(d._id) === s.id);
      const customer = del?.customerId as { name?: string; phone?: string } | undefined;
      return {
        lat: s.lat,
        lng: s.lng,
        deliveryId: s.id,
        order: i + 1,
        label: customer?.name ?? customer?.phone ?? `Stop ${i + 1}`,
        deliveryStatus: del?.status,
      };
    }),
    pathGeometry: road?.pathGeometry ?? [],
    outboundDistanceKm: road?.outboundDistanceKm ?? optimized.totalDistanceMeters / 1000,
    returnDistanceKm: road?.returnDistanceKm ?? 0,
    roundTripDistanceKm: road?.roundTripDistanceKm ?? optimized.totalDistanceMeters / 1000,
    totalDurationMin: road?.roundTripDurationMin ?? Math.round(optimized.totalDurationSeconds / 60),
    roundTripCost: road?.roundTripCost ?? (optimized.totalDistanceMeters / 1000) * 10,
    costPerKm: road?.costPerKm ?? 10,
    stopCount: optimized.stops.length,
    deliveredCount,
  };
}

export async function buildRouteSummaryFromRun(
  origin: { lat: number; lng: number },
  run: Pick<IDeliveryRun, "_id" | "runNumber" | "status" | "startedAt" | "departedAt" | "endedAt" | "stops">
): Promise<RiderRouteSummary | null> {
  if (!run.stops?.length) return null;

  const deliveryIds = run.stops.map((s) => s.deliveryId);
  const deliveries = await Delivery.find({ _id: { $in: deliveryIds } })
    .populate("customerId", "name phone")
    .lean();

  const byId = new Map(deliveries.map((d) => [String(d._id), d]));
  const ordered = run.stops
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((stop) => {
      const d = byId.get(String(stop.deliveryId));
      return {
        _id: stop.deliveryId,
        coordinates: { lat: stop.lat, lng: stop.lng },
        routeOrder: stop.order,
        status: d?.status,
        customerId: d?.customerId,
      };
    });

  return buildRouteSummaryFromDeliveries(origin, ordered, {
    runId: String(run._id),
    runNumber: run.runNumber,
    runStatus: run.status as RiderRouteSummary["runStatus"],
    completedAt: run.endedAt,
    startedAt: run.departedAt ?? run.startedAt,
    estimatedReturnAt: run.endedAt,
  });
}
