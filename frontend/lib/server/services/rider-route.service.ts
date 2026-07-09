import type { Types } from "mongoose";
import { planRoadRouteRoundTrip } from "./route-optimization.service";

export interface RiderRoutePlan {
  warehouse: { lat: number; lng: number; label?: string };
  pathGeometry: { lat: number; lng: number }[];
  stops: { deliveryId: string; order: number; lat: number; lng: number; label: string }[];
  outboundDistanceKm: number;
  returnDistanceKm: number;
  roundTripDistanceKm: number;
  totalDurationMin: number;
  roundTripCost: number;
  costPerKm: number;
  stopCount: number;
}

type DeliveryLike = {
  _id: unknown;
  coordinates?: { lat?: number; lng?: number };
  routeOrder?: number;
  customerId?: { name?: string; phone?: string } | string | Types.ObjectId;
};

export async function buildRiderRoutePlan(
  warehouse: { lat: number; lng: number; label?: string },
  deliveries: DeliveryLike[]
): Promise<RiderRoutePlan | null> {
  const ordered = [...deliveries]
    .filter((d) => d.coordinates?.lat != null && d.coordinates?.lng != null)
    .sort((a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999));

  if (!ordered.length) return null;

  const stops = ordered.map((d) => ({
    id: String(d._id),
    lat: d.coordinates!.lat!,
    lng: d.coordinates!.lng!,
  }));

  const { optimized, road } = await planRoadRouteRoundTrip(warehouse, stops);

  return {
    warehouse,
    pathGeometry: road?.pathGeometry ?? [],
    stops: optimized.stops.map((s, i) => {
      const del = ordered.find((d) => String(d._id) === s.id);
      const customer = del?.customerId;
      const label =
        customer &&
        typeof customer === "object" &&
        "name" in customer &&
        (customer.name ?? customer.phone)
          ? customer.name ?? customer.phone ?? `Stop ${i + 1}`
          : `Stop ${i + 1}`;
      return {
        deliveryId: s.id,
        order: i + 1,
        lat: s.lat,
        lng: s.lng,
        label,
      };
    }),
    outboundDistanceKm: road?.outboundDistanceKm ?? optimized.totalDistanceMeters / 1000,
    returnDistanceKm: road?.returnDistanceKm ?? 0,
    roundTripDistanceKm: road?.roundTripDistanceKm ?? optimized.totalDistanceMeters / 1000,
    totalDurationMin: road?.roundTripDurationMin ?? Math.round(optimized.totalDurationSeconds / 60),
    roundTripCost: road?.roundTripCost ?? (optimized.totalDistanceMeters / 1000) * 10,
    costPerKm: road?.costPerKm ?? 10,
    stopCount: optimized.stops.length,
  };
}
