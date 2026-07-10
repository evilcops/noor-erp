import { haversineDistanceMeters } from "./geocoding.service";
import { DISPATCH_CONFIG } from "../config/dispatch.config";

export function estimateTravelMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const meters = haversineDistanceMeters(from, to);
  return Math.max(1, Math.ceil(meters / DISPATCH_CONFIG.avgSpeedMps / 60));
}

export function computeWarehouseReadyAt(
  orderCreatedAt: Date,
  prepMinutes = DISPATCH_CONFIG.prepMinutes
): Date {
  return new Date(orderCreatedAt.getTime() + prepMinutes * 60_000);
}

/** Per-stop ETAs along an optimised route */
export function computeRouteStopEtas(input: {
  origin: { lat: number; lng: number };
  stops: { id: string; lat: number; lng: number }[];
  departAt: Date;
  totalDurationSeconds: number;
  serviceMinutes?: number;
}): Map<string, { estimatedArrival: Date; travelTimeMinutes: number }> {
  const serviceMin = input.serviceMinutes ?? DISPATCH_CONFIG.avgStopServiceMinutes;
  const result = new Map<string, { estimatedArrival: Date; travelTimeMinutes: number }>();
  if (!input.stops.length) return result;

  const legMeters: number[] = [];
  let prev = input.origin;
  for (const stop of input.stops) {
    legMeters.push(haversineDistanceMeters(prev, stop));
    prev = stop;
  }
  const totalMeters = legMeters.reduce((s, m) => s + m, 0) || 1;

  let cursor = input.departAt;
  for (let i = 0; i < input.stops.length; i++) {
    const legSec = Math.round(input.totalDurationSeconds * (legMeters[i] / totalMeters));
    const travelMin = Math.max(1, Math.ceil(legSec / 60));
    cursor = new Date(cursor.getTime() + legSec * 1000);
    result.set(input.stops[i].id, {
      estimatedArrival: new Date(cursor),
      travelTimeMinutes: travelMin,
    });
    cursor = new Date(cursor.getTime() + serviceMin * 60_000);
  }

  return result;
}

/** Whether a rider can deliver all stops before their promise windows end */
export function canRiderMeetPromises(input: {
  riderAvailableAt: Date;
  warehouseReadyAt: Date;
  origin: { lat: number; lng: number };
  deliveries: {
    _id: { toString(): string };
    coordinates?: { lat: number; lng: number };
    promisedWindowEnd?: Date;
  }[];
  existingLoad: number;
}): boolean {
  const departAt = new Date(
    Math.max(input.riderAvailableAt.getTime(), input.warehouseReadyAt.getTime())
  );

  let cursor = departAt;
  let prev = input.origin;
  const serviceMs = DISPATCH_CONFIG.avgStopServiceMinutes * 60_000;

  for (let i = 0; i < input.deliveries.length; i++) {
    const d = input.deliveries[i];
    const coords = d.coordinates;
    if (!coords?.lat) continue;

    const travelMin = estimateTravelMinutes(prev, coords);
    cursor = new Date(cursor.getTime() + travelMin * 60_000);

    if (d.promisedWindowEnd && cursor > d.promisedWindowEnd) {
      return false;
    }

    cursor = new Date(cursor.getTime() + serviceMs);
    prev = coords;
  }

  return true;
}
