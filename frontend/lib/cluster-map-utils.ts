import type { DeliveryCluster } from "@/lib/api/clusters";

const KM_PER_DEGREE_LAT = 111.32;

export const MAIN_SERVICE_RADIUS_KM = 10;
export const CLUSTER_SECTOR_COUNT = 5;

function offsetKmFromPoint(
  base: { lat: number; lng: number },
  kmNorth: number,
  kmEast: number
) {
  const lat = base.lat + kmNorth / KM_PER_DEGREE_LAT;
  const lng = base.lng + kmEast / (KM_PER_DEGREE_LAT * Math.cos((base.lat * Math.PI) / 180));
  return { lat, lng };
}

export function squareCellBounds(
  center: { lat: number; lng: number },
  halfKm: number
): [[number, number], [number, number]] {
  const north = offsetKmFromPoint(center, halfKm, 0);
  const south = offsetKmFromPoint(center, -halfKm, 0);
  const east = offsetKmFromPoint(center, 0, halfKm);
  const west = offsetKmFromPoint(center, 0, -halfKm);
  return [
    [south.lat, west.lng],
    [north.lat, east.lng],
  ];
}

export function sectorPolygonLatLng(
  origin: { lat: number; lng: number },
  startDeg: number,
  endDeg: number,
  radiusKm: number,
  steps = 24
): [number, number][] {
  const ring: [number, number][] = [[origin.lat, origin.lng]];
  const stepDeg = (endDeg - startDeg) / steps;
  for (let i = 0; i <= steps; i++) {
    const bearingRad = ((startDeg + stepDeg * i) * Math.PI) / 180;
    const kmNorth = radiusKm * Math.cos(bearingRad);
    const kmEast = radiusKm * Math.sin(bearingRad);
    const pt = offsetKmFromPoint(origin, kmNorth, kmEast);
    ring.push([pt.lat, pt.lng]);
  }
  ring.push([origin.lat, origin.lng]);
  return ring;
}

export function clusterMapBounds(cluster: DeliveryCluster): [[number, number], [number, number]] | null {
  if (cluster.shape === "square" && cluster.cellSizeKm) {
    const half = cluster.cellSizeKm / 2;
    return squareCellBounds(cluster.center, half);
  }
  return null;
}

export function clusterSectorPolygon(
  cluster: DeliveryCluster,
  warehouse?: { lat: number; lng: number } | null
): [number, number][] | null {
  if (cluster.shape !== "sector") return null;
  if (cluster.sectorStartDeg == null || cluster.sectorEndDeg == null) return null;
  const origin = cluster.origin ?? warehouse ?? cluster.center;
  return sectorPolygonLatLng(
    origin,
    cluster.sectorStartDeg,
    cluster.sectorEndDeg,
    cluster.radiusKm
  );
}

export function clusterMainRadiusKm(cluster: DeliveryCluster): number {
  return cluster.mainRadiusKm ?? MAIN_SERVICE_RADIUS_KM;
}
