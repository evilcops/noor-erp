import type { GeoCoordinates } from "./geocoding.service";
import { haversineDistanceMeters } from "./geocoding.service";

const OSRM_BASE = "https://router.project-osrm.org";

export interface RouteStop {
  id: string;
  lat: number;
  lng: number;
}

export interface OptimizedRoute {
  stops: RouteStop[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

/** Nearest-neighbor TSP heuristic, refined with OSRM trip when available */
export async function optimizeRoute(
  origin: GeoCoordinates,
  stops: RouteStop[]
): Promise<OptimizedRoute> {
  if (stops.length === 0) {
    return { stops: [], totalDistanceMeters: 0, totalDurationSeconds: 0 };
  }

  if (stops.length === 1) {
    const osrm = await fetchOsrmTrip(origin, stops);
    if (osrm) return osrm;
    const dist = haversineDistanceMeters(origin, stops[0]);
    return {
      stops,
      totalDistanceMeters: dist,
      totalDurationSeconds: Math.round(dist / 8),
    };
  }

  const osrm = await fetchOsrmTrip(origin, stops);
  if (osrm) return osrm;

  const remaining = [...stops];
  const ordered: RouteStop[] = [];
  let current = origin;
  let totalDistance = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistanceMeters(current, remaining[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    totalDistance += nearestDist;
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    current = next;
  }

  return {
    stops: ordered,
    totalDistanceMeters: totalDistance,
    totalDurationSeconds: Math.round(totalDistance / 8),
  };
}

async function fetchOsrmTrip(
  origin: GeoCoordinates,
  stops: RouteStop[]
): Promise<OptimizedRoute | null> {
  try {
    const coords = [
      `${origin.lng},${origin.lat}`,
      ...stops.map((s) => `${s.lng},${s.lat}`),
    ].join(";");

    const params = new URLSearchParams({
      source: "first",
      roundtrip: "false",
      destination: "last",
      geometries: "false",
      overview: "false",
    });

    const res = await fetch(`${OSRM_BASE}/trip/v1/driving/${coords}?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      code: string;
      waypoints: { waypoint_index: number }[];
      trips: { distance: number; duration: number }[];
    };

    if (data.code !== "Ok" || !data.waypoints?.length) return null;

    const waypointOrder = data.waypoints
      .slice(1)
      .map((w, idx) => ({ idx: idx + 1, order: w.waypoint_index }))
      .sort((a, b) => a.order - b.order)
      .map((w) => stops[w.idx - 1]);

    return {
      stops: waypointOrder,
      totalDistanceMeters: data.trips[0]?.distance ?? 0,
      totalDurationSeconds: data.trips[0]?.duration ?? 0,
    };
  } catch {
    return null;
  }
}

/** Historical demand: count deliveries by area and day-of-week */
export function getDayOfWeekPriority(
  area: string | undefined,
  dayOfWeek: number,
  historicalCounts: Map<string, number>
): number {
  if (!area) return 50;
  const key = `${area.toLowerCase()}:${dayOfWeek}`;
  const count = historicalCounts.get(key) ?? 0;
  return Math.min(100, 50 + count * 5);
}
