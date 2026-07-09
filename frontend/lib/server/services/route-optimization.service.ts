import type { GeoCoordinates } from "./geocoding.service";
import { haversineDistanceMeters } from "./geocoding.service";

const OSRM_BASE = "https://router.project-osrm.org";

/** Round-trip route cost (PKR per km) — warehouse → stops → warehouse */
export const ROUTE_COST_PER_KM = 10;

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

export interface RoadRoutePlan {
  /** Road-following path for map (lat/lng) */
  pathGeometry: GeoCoordinates[];
  /** Warehouse → all stops */
  outboundDistanceKm: number;
  /** Last stop → warehouse */
  returnDistanceKm: number;
  roundTripDistanceKm: number;
  roundTripDurationMin: number;
  roundTripCost: number;
  costPerKm: number;
}

/** Decode OSRM GeoJSON linestring [lng,lat][] → {lat,lng}[] */
function decodeOsrmGeometry(coordinates: [number, number][]): GeoCoordinates[] {
  return coordinates.map(([lng, lat]) => ({ lat, lng }));
}

/** Driving route along roads for an ordered list of waypoints */
async function fetchOsrmRouteGeometry(
  waypoints: GeoCoordinates[]
): Promise<{ geometry: GeoCoordinates[]; distanceMeters: number; durationSeconds: number } | null> {
  if (waypoints.length < 2) return null;

  try {
    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
    const params = new URLSearchParams({
      geometries: "geojson",
      overview: "full",
    });

    const res = await fetch(`${OSRM_BASE}/route/v1/driving/${coords}?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      code: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }[];
    };

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    return {
      geometry: decodeOsrmGeometry(route.geometry.coordinates),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return null;
  }
}

function straightLineGeometry(waypoints: GeoCoordinates[]): GeoCoordinates[] {
  return waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
}

function sumLegDistances(waypoints: GeoCoordinates[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += haversineDistanceMeters(waypoints[i - 1], waypoints[i]);
  }
  return total;
}

/**
 * Optimized stop order + road-following round trip (out to stops, back to warehouse)
 * with cost at ROUTE_COST_PER_KM per km.
 */
export async function planRoadRouteRoundTrip(
  origin: GeoCoordinates,
  stops: RouteStop[]
): Promise<{ optimized: OptimizedRoute; road: RoadRoutePlan | null }> {
  const optimized = await optimizeRoute(origin, stops);
  if (optimized.stops.length === 0) {
    return { optimized, road: null };
  }

  const stopCoords = optimized.stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const outboundWaypoints = [origin, ...stopCoords];
  const lastStop = stopCoords[stopCoords.length - 1];

  const [outbound, returnLeg] = await Promise.all([
    fetchOsrmRouteGeometry(outboundWaypoints),
    fetchOsrmRouteGeometry([lastStop, origin]),
  ]);

  const outboundMeters = outbound?.distanceMeters ?? sumLegDistances(outboundWaypoints);
  const returnMeters = returnLeg?.distanceMeters ?? haversineDistanceMeters(lastStop, origin);
  const roundTripMeters = outboundMeters + returnMeters;
  const roundTripKm = roundTripMeters / 1000;
  const durationSec =
    (outbound?.durationSeconds ?? 0) + (returnLeg?.durationSeconds ?? 0) ||
    optimized.totalDurationSeconds + Math.round(returnMeters / 8);

  let pathGeometry: GeoCoordinates[];
  if (outbound?.geometry && returnLeg?.geometry) {
    pathGeometry = [...outbound.geometry, ...returnLeg.geometry.slice(1)];
  } else if (outbound?.geometry) {
    pathGeometry = outbound.geometry;
  } else {
    pathGeometry = straightLineGeometry([...outboundWaypoints, origin]);
  }

  return {
    optimized,
    road: {
      pathGeometry,
      outboundDistanceKm: outboundMeters / 1000,
      returnDistanceKm: returnMeters / 1000,
      roundTripDistanceKm: roundTripKm,
      roundTripDurationMin: Math.round(durationSec / 60),
      roundTripCost: roundTripKm * ROUTE_COST_PER_KM,
      costPerKm: ROUTE_COST_PER_KM,
    },
  };
}

function roundTripDistanceMeters(origin: GeoCoordinates, stops: RouteStop[]): number {
  if (stops.length === 0) return 0;
  let total = haversineDistanceMeters(origin, stops[0]);
  for (let i = 1; i < stops.length; i++) {
    total += haversineDistanceMeters(stops[i - 1], stops[i]);
  }
  total += haversineDistanceMeters(stops[stops.length - 1], origin);
  return total;
}

/** Nearest-neighbor visit order from warehouse, including return leg in distance. */
function nearestNeighborOrder(origin: GeoCoordinates, stops: RouteStop[]): RouteStop[] {
  const remaining = [...stops];
  const ordered: RouteStop[] = [];
  let current = origin;

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
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    current = next;
  }

  return ordered;
}

/** 2-opt refinement for shortest warehouse → stops → warehouse round trip. */
function twoOptImprove(origin: GeoCoordinates, stops: RouteStop[]): RouteStop[] {
  if (stops.length < 3) return stops;

  let best = [...stops];
  let bestDist = roundTripDistanceMeters(origin, best);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const dist = roundTripDistanceMeters(origin, candidate);
        if (dist < bestDist) {
          best = candidate;
          bestDist = dist;
          improved = true;
        }
      }
    }
  }

  return best;
}

function orderStopsHeuristic(origin: GeoCoordinates, stops: RouteStop[]): RouteStop[] {
  return twoOptImprove(origin, nearestNeighborOrder(origin, stops));
}
/** Shortest visit order (warehouse → all stops → warehouse) via OSRM trip, with 2-opt fallback */
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
    const dist = roundTripDistanceMeters(origin, stops);
    return {
      stops,
      totalDistanceMeters: dist,
      totalDurationSeconds: Math.round(dist / 8),
    };
  }

  const osrm = await fetchOsrmTrip(origin, stops);
  if (osrm) return osrm;

  const ordered = orderStopsHeuristic(origin, stops);
  const totalDistance = roundTripDistanceMeters(origin, ordered);

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
      roundtrip: "true",
      geometries: "false",
      overview: "false",
    });

    const res = await fetch(`${OSRM_BASE}/trip/v1/driving/${coords}?${params}`, {
      signal: AbortSignal.timeout(15000),
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
      .map((w, idx) => ({ stopIdx: idx, tripPosition: w.waypoint_index }))
      .sort((a, b) => a.tripPosition - b.tripPosition)
      .map((w) => stops[w.stopIdx]);

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
