import type { Types } from "mongoose";
import {
  expandedRegionToArc,
  validateExpandedRegionsNoOverlap,
  type DeliveryExpandedRegion,
} from "@/lib/compass-directions";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import { geocodeAddress, type GeoCoordinates } from "./geocoding.service";

/** Total service area around warehouse */
export const MAIN_SERVICE_RADIUS_KM = 10;
export const DEFAULT_CLUSTER_SECTOR_COUNT = 5;
export const MIN_CLUSTER_SECTOR_COUNT = 2;
export const MIN_EXPANDED_REGION_CLUSTER_COUNT = 1;
export const MAX_CLUSTER_SECTOR_COUNT = 24;
/** @deprecated use DEFAULT_CLUSTER_SECTOR_COUNT */
export const CLUSTER_SECTOR_COUNT = DEFAULT_CLUSTER_SECTOR_COUNT;
export const MIN_CLUSTER_COUNT = MIN_CLUSTER_SECTOR_COUNT;

const KM_PER_DEGREE_LAT = 111.32;
const SECTOR_ARC_STEPS = 24;

export type ClusterShape = "circle" | "square" | "sector";

export interface ClusterGridCell {
  code: string;
  name: string;
  center: GeoCoordinates;
  shape: ClusterShape;
  cellSizeKm: number;
  radiusKm: number;
  mainRadiusKm: number;
  sectorStartDeg?: number;
  sectorEndDeg?: number;
  description: string;
  gridRow: number;
  gridCol: number;
}

/** Convert km offsets (north / east) to lat/lng from a base point */
export function offsetKmFromPoint(
  base: GeoCoordinates,
  kmNorth: number,
  kmEast: number
): GeoCoordinates {
  const lat = base.lat + kmNorth / KM_PER_DEGREE_LAT;
  const lng = base.lng + kmEast / (KM_PER_DEGREE_LAT * Math.cos((base.lat * Math.PI) / 180));
  return { lat, lng };
}

/** Haversine distance in km */
export function distanceKm(a: GeoCoordinates, b: GeoCoordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Whether a 2 km square cell (axis-aligned in km space) intersects the main service disk */
export function squareCellIntersectsMainRadius(
  cellCenterKmNorth: number,
  cellCenterKmEast: number,
  halfCellKm: number,
  mainRadiusKm: number
): boolean {
  const minN = cellCenterKmNorth - halfCellKm;
  const maxN = cellCenterKmNorth + halfCellKm;
  const minE = cellCenterKmEast - halfCellKm;
  const maxE = cellCenterKmEast + halfCellKm;

  const closestN = Math.max(minN, Math.min(0, maxN));
  const closestE = Math.max(minE, Math.min(0, maxE));
  if (Math.sqrt(closestN ** 2 + closestE ** 2) <= mainRadiusKm) return true;

  const corners: [number, number][] = [
    [minN, minE],
    [minN, maxE],
    [maxN, minE],
    [maxN, maxE],
  ];
  return corners.some(([n, e]) => Math.sqrt(n * n + e * e) <= mainRadiusKm);
}

/** Leaflet bounds [[south, west], [north, east]] for a square cell */
export function squareCellBounds(
  center: GeoCoordinates,
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

export function pointInSquareCluster(
  point: GeoCoordinates,
  center: GeoCoordinates,
  halfKm: number
): boolean {
  const kmNorth = (point.lat - center.lat) * KM_PER_DEGREE_LAT;
  const kmEast =
    (point.lng - center.lng) *
    KM_PER_DEGREE_LAT *
    Math.cos((center.lat * Math.PI) / 180);
  return Math.abs(kmNorth) <= halfKm && Math.abs(kmEast) <= halfKm;
}

export function bearingFromNorthDeg(kmNorth: number, kmEast: number): number {
  let bearing = (Math.atan2(kmEast, kmNorth) * 180) / Math.PI;
  if (bearing < 0) bearing += 360;
  return bearing;
}

export function bearingInSector(bearing: number, startDeg: number, endDeg: number): boolean {
  const normalized = ((bearing % 360) + 360) % 360;
  if (startDeg < endDeg) {
    return normalized >= startDeg && normalized < endDeg;
  }
  return normalized >= startDeg || normalized < endDeg;
}

export function kmOffsetFromPoint(
  origin: GeoCoordinates,
  point: GeoCoordinates
): { kmNorth: number; kmEast: number } {
  const kmNorth = (point.lat - origin.lat) * KM_PER_DEGREE_LAT;
  const kmEast =
    (point.lng - origin.lng) *
    KM_PER_DEGREE_LAT *
    Math.cos((origin.lat * Math.PI) / 180);
  return { kmNorth, kmEast };
}

export function pointInSectorCluster(
  point: GeoCoordinates,
  origin: GeoCoordinates,
  startDeg: number,
  endDeg: number,
  radiusKm: number
): boolean {
  const { kmNorth, kmEast } = kmOffsetFromPoint(origin, point);
  const distance = Math.sqrt(kmNorth ** 2 + kmEast ** 2);
  if (distance > radiusKm) return false;
  if (distance === 0) return true;
  return bearingInSector(bearingFromNorthDeg(kmNorth, kmEast), startDeg, endDeg);
}

export function pointInCluster(
  point: GeoCoordinates,
  cluster: {
    center: GeoCoordinates;
    shape?: ClusterShape;
    cellSizeKm?: number;
    radiusKm: number;
    sectorStartDeg?: number;
    sectorEndDeg?: number;
    origin?: GeoCoordinates;
  }
): boolean {
  if (cluster.shape === "sector") {
    const origin = cluster.origin ?? cluster.center;
    if (cluster.sectorStartDeg == null || cluster.sectorEndDeg == null) return false;
    return pointInSectorCluster(
      point,
      origin,
      cluster.sectorStartDeg,
      cluster.sectorEndDeg,
      cluster.radiusKm
    );
  }
  if (cluster.shape === "square" && cluster.cellSizeKm) {
    const half = cluster.cellSizeKm / 2;
    return pointInSquareCluster(point, cluster.center, half);
  }
  return distanceKm(point, cluster.center) <= cluster.radiusKm;
}

/**
 * Find the active cluster (across all main branches of a company) that contains a point.
 * Ties are broken by the closest cluster center. Optionally restrict to one branch.
 */
export async function resolveClusterForCompanyPoint(
  companyId: Types.ObjectId | string,
  coordinates?: GeoCoordinates | null,
  branchId?: Types.ObjectId | string
) {
  if (coordinates?.lat == null || coordinates?.lng == null) return null;

  const filter: Record<string, unknown> = {
    companyId,
    status: "active",
    deletedAt: null,
  };
  if (branchId) filter.branchId = branchId;

  const clusters = await DeliveryCluster.find(filter).lean();

  let best: (typeof clusters)[number] | null = null;
  let bestDist = Infinity;

  for (const c of clusters) {
    const inside = pointInCluster(coordinates, {
      center: c.center,
      origin: c.origin ?? undefined,
      shape: c.shape,
      cellSizeKm: c.cellSizeKm,
      radiusKm: c.radiusKm,
      sectorStartDeg: c.sectorStartDeg,
      sectorEndDeg: c.sectorEndDeg,
    });
    if (!inside) continue;
    const dist = distanceKm(coordinates, c.center);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }

  return best;
}

/** Polygon ring for a pie-sector wedge (warehouse at origin) */
export function sectorPolygonLatLng(
  origin: GeoCoordinates,
  startDeg: number,
  endDeg: number,
  radiusKm: number,
  steps = SECTOR_ARC_STEPS
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

function sectorCodeForIndex(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return String(index + 1).padStart(2, "0");
}

export function sectorLabelForIndex(index: number, sectorCount: number): string {
  const compass = ["North", "North-East", "South-East", "South-West", "North-West"];
  if (sectorCount === 5 && compass[index]) return compass[index];
  return `Sector ${index + 1}`;
}

export function sectorAnglesForIndex(
  sectorIndex: number,
  sectorCount: number
): { startDeg: number; endDeg: number; sliceDeg: number } {
  const sliceDeg = 360 / sectorCount;
  return {
    sliceDeg,
    startDeg: sectorIndex * sliceDeg,
    endDeg: (sectorIndex + 1) * sliceDeg,
  };
}

export const CLUSTER_DIRECTIONS = [
  { value: "north", label: "North", index: 0 },
  { value: "north_east", label: "North-East", index: 1 },
  { value: "south_east", label: "South-East", index: 2 },
  { value: "south_west", label: "South-West", index: 3 },
  { value: "north_west", label: "North-West", index: 4 },
] as const;

/** @deprecated use CompassDirection from @/lib/compass-directions */
export type ClusterDirection = (typeof CLUSTER_DIRECTIONS)[number]["value"];

export function directionToSectorIndex(direction: ClusterDirection): number {
  const match = CLUSTER_DIRECTIONS.find((d) => d.value === direction);
  if (!match) throw new Error(`Invalid cluster direction: ${direction}`);
  return match.index;
}

export function sectorIndexToDirection(index: number): ClusterDirection | null {
  return CLUSTER_DIRECTIONS[index]?.value ?? null;
}

export function sectorIndexToLabel(index: number, sectorCount = DEFAULT_CLUSTER_SECTOR_COUNT): string {
  return sectorLabelForIndex(index, sectorCount);
}

export function planSectorClusterForIndex(
  warehouse: GeoCoordinates,
  sectorIndex: number,
  options?: {
    mainRadiusKm?: number;
    sectorCount?: number;
    branchCode?: string;
    branchName?: string;
  }
): ClusterGridCell {
  const sectorCount = options?.sectorCount ?? DEFAULT_CLUSTER_SECTOR_COUNT;
  const cells = planSectorClusterGrid(warehouse, { ...options, sectorCount });
  const cell = cells[sectorIndex];
  if (!cell) throw new Error(`Invalid sector index ${sectorIndex} for ${sectorCount} clusters`);
  return cell;
}

export function planSectorClusterForDirection(
  warehouse: GeoCoordinates,
  direction: ClusterDirection,
  options?: {
    mainRadiusKm?: number;
    sectorCount?: number;
    branchCode?: string;
    branchName?: string;
  }
): ClusterGridCell {
  return planSectorClusterForIndex(warehouse, directionToSectorIndex(direction), {
    ...options,
    sectorCount: options?.sectorCount ?? DEFAULT_CLUSTER_SECTOR_COUNT,
  });
}

function planArcSectors(
  warehouse: GeoCoordinates,
  arcStartDeg: number,
  spanDeg: number,
  radiusKm: number,
  clusterCount: number,
  branchCode: string,
  branchName: string,
  gridTotalCount: number
): ClusterGridCell[] {
  if (clusterCount < 1 || spanDeg <= 0) return [];
  const sliceDeg = spanDeg / clusterCount;
  const cells: ClusterGridCell[] = [];

  for (let i = 0; i < clusterCount; i++) {
    const startDeg = arcStartDeg + i * sliceDeg;
    const endDeg = startDeg + sliceDeg;
    const midDeg = startDeg + sliceDeg / 2;
    const midRad = (midDeg * Math.PI) / 180;
    const labelKm = radiusKm * 0.55;
    const center = offsetKmFromPoint(
      warehouse,
      labelKm * Math.cos(midRad),
      labelKm * Math.sin(midRad)
    );

    cells.push({
      code: "",
      name: "",
      center,
      shape: "sector",
      cellSizeKm: 0,
      radiusKm,
      mainRadiusKm: radiusKm,
      sectorStartDeg: startDeg % 360,
      sectorEndDeg: endDeg % 360 || 360,
      description: `${sliceDeg.toFixed(1)}° slice · ${radiusKm} km · grid ${gridTotalCount}`,
      gridRow: i,
      gridCol: 0,
    });
  }

  return cells;
}

/**
 * Base grid plus one or more expanded directional arcs.
 */
export function planRegionalClusterGrid(
  warehouse: GeoCoordinates,
  options: {
    baseRadiusKm: number;
    baseClusterCount: number;
    branchCode?: string;
    branchName?: string;
    expandedRegions?: DeliveryExpandedRegion[] | null;
  }
): ClusterGridCell[] {
  const branchCode = (options.branchCode ?? "BR").toUpperCase();
  const branchName = options.branchName ?? "Branch";
  const regions = options.expandedRegions?.filter(
    (r) => r.fromDirection && r.toDirection
  );

  if (!regions?.length) {
    return planSectorClusterGrid(warehouse, {
      mainRadiusKm: options.baseRadiusKm,
      sectorCount: options.baseClusterCount,
      branchCode,
      branchName,
    });
  }

  validateExpandedRegionsNoOverlap(regions);

  type ArcPlan = {
    startDeg: number;
    spanDeg: number;
    radiusKm: number;
    clusterCount: number;
    label: string;
    isExpanded: boolean;
  };

  const expandedArcs: ArcPlan[] = regions.map((region) => {
    const arc = expandedRegionToArc(region);
    return {
      startDeg: arc.startDeg,
      spanDeg: arc.spanDeg,
      radiusKm: Math.min(100, Math.max(1, region.radiusKm)),
      clusterCount: Math.min(
        MAX_CLUSTER_SECTOR_COUNT,
        Math.max(MIN_EXPANDED_REGION_CLUSTER_COUNT, region.clusterCount)
      ),
      label: arc.label,
      isExpanded: true,
    };
  }).sort((a, b) => a.startDeg - b.startDeg);

  const segments: ArcPlan[] = [];
  let cursor = 0;

  const pushGap = (fromDeg: number, toDeg: number) => {
    const spanDeg = (toDeg - fromDeg + 360) % 360;
    if (spanDeg <= 0) return;
    const clusterCount = Math.max(
      MIN_CLUSTER_SECTOR_COUNT,
      Math.min(
        MAX_CLUSTER_SECTOR_COUNT,
        Math.round(options.baseClusterCount * (spanDeg / 360))
      )
    );
    segments.push({
      startDeg: fromDeg,
      spanDeg,
      radiusKm: options.baseRadiusKm,
      clusterCount,
      label: `base (${spanDeg}°)`,
      isExpanded: false,
    });
  };

  for (const arc of expandedArcs) {
    pushGap(cursor, arc.startDeg);
    segments.push(arc);
    cursor = (arc.startDeg + arc.spanDeg) % 360;
  }
  pushGap(cursor, expandedArcs[0]?.startDeg ?? 0);

  const gridTotalCount = segments.reduce((sum, s) => sum + s.clusterCount, 0);
  let allCells: ClusterGridCell[] = [];

  for (const segment of segments) {
    const cells = planArcSectors(
      warehouse,
      segment.startDeg,
      segment.spanDeg,
      segment.radiusKm,
      segment.clusterCount,
      branchCode,
      branchName,
      gridTotalCount
    );
    allCells = allCells.concat(
      cells.map((cell) => ({
        ...cell,
        description: `${segment.label} · ${cell.description}`,
      }))
    );
  }

  return allCells.map((cell, index) => {
    const codeLetter = sectorCodeForIndex(index);
    return {
      ...cell,
      code: `${branchCode}-${codeLetter}`,
      name: `Zone ${codeLetter} — ${branchName}`,
      gridRow: index,
    };
  });
}

/**
 * Divide the service disk into equal non-overlapping pie sectors.
 */
export function planSectorClusterGrid(
  warehouse: GeoCoordinates,
  options?: {
    mainRadiusKm?: number;
    sectorCount?: number;
    branchCode?: string;
    branchName?: string;
  }
): ClusterGridCell[] {
  const mainRadiusKm = options?.mainRadiusKm ?? MAIN_SERVICE_RADIUS_KM;
  const sectorCount = options?.sectorCount ?? DEFAULT_CLUSTER_SECTOR_COUNT;
  const branchCode = (options?.branchCode ?? "BR").toUpperCase();
  const branchName = options?.branchName ?? "Branch";
  const sliceDeg = 360 / sectorCount;

  const cells: ClusterGridCell[] = [];
  for (let i = 0; i < sectorCount; i++) {
    const startDeg = i * sliceDeg;
    const endDeg = (i + 1) * sliceDeg;
    const midDeg = startDeg + sliceDeg / 2;
    const midRad = (midDeg * Math.PI) / 180;
    const labelKm = mainRadiusKm * 0.55;
    const center = offsetKmFromPoint(
      warehouse,
      labelKm * Math.cos(midRad),
      labelKm * Math.sin(midRad)
    );

    const label = sectorLabelForIndex(i, sectorCount);
    const codeLetter = sectorCodeForIndex(i);

    cells.push({
      code: `${branchCode}-${codeLetter}`,
      name: `Zone ${codeLetter} (${label}) — ${branchName}`,
      center,
      shape: "sector",
      cellSizeKm: 0,
      radiusKm: mainRadiusKm,
      mainRadiusKm,
      sectorStartDeg: startDeg,
      sectorEndDeg: endDeg,
      description: `Pie sector ${i + 1} of ${sectorCount} (${sliceDeg}°) within ${mainRadiusKm} km service area`,
      gridRow: i,
      gridCol: 0,
    });
  }

  return cells;
}

/** @deprecated use planSectorClusterGrid */
export function planTessellatedClusterGrid(
  warehouse: GeoCoordinates,
  options?: {
    mainRadiusKm?: number;
    cellSizeKm?: number;
    branchCode?: string;
    branchName?: string;
  }
) {
  return planSectorClusterGrid(warehouse, options);
}

/** @deprecated use planTessellatedClusterGrid */
export function planNonOverlappingClusterGrid(
  warehouse: GeoCoordinates,
  options?: { branchCode?: string; branchName?: string }
) {
  return planTessellatedClusterGrid(warehouse, options);
}

export async function resolveBranchWarehouseCenter(branch: {
  gpsCoordinates?: GeoCoordinates | null;
  address?: string | null;
}): Promise<GeoCoordinates> {
  if (branch.gpsCoordinates?.lat != null && branch.gpsCoordinates?.lng != null) {
    return branch.gpsCoordinates;
  }
  if (branch.address?.trim()) {
    const geocoded = await geocodeAddress(branch.address);
    if (geocoded) return geocoded;
  }
  return { lat: 23.588, lng: 58.3829 };
}

export async function createDefaultClustersForBranch(input: {
  companyId: Types.ObjectId | string;
  branchId: Types.ObjectId | string;
  branchCode: string;
  branchName: string;
  warehouse: GeoCoordinates;
  userId: Types.ObjectId | string;
  replaceExisting?: boolean;
  sectorCount?: number;
  mainRadiusKm?: number;
  expandedRegions?: DeliveryExpandedRegion[] | null;
}) {
  const existing = await DeliveryCluster.countDocuments({
    branchId: input.branchId,
    deletedAt: null,
  });
  if (existing > 0 && !input.replaceExisting) return [];

  const sectorCount = input.sectorCount ?? DEFAULT_CLUSTER_SECTOR_COUNT;
  const mainRadiusKm = input.mainRadiusKm ?? MAIN_SERVICE_RADIUS_KM;

  const plan =
    input.expandedRegions && input.expandedRegions.length > 0
      ? planRegionalClusterGrid(input.warehouse, {
          baseRadiusKm: mainRadiusKm,
          baseClusterCount: sectorCount,
          branchCode: input.branchCode.toUpperCase(),
          branchName: input.branchName,
          expandedRegions: input.expandedRegions,
        })
      : planSectorClusterGrid(input.warehouse, {
          branchCode: input.branchCode.toUpperCase(),
          branchName: input.branchName,
          sectorCount,
          mainRadiusKm,
        });

  if (input.replaceExisting && existing > 0) {
    await DeliveryCluster.deleteMany({ branchId: input.branchId });
  }

  const created = await DeliveryCluster.insertMany(
    plan.map((cell) => ({
      companyId: input.companyId,
      branchId: input.branchId,
      code: cell.code,
      name: cell.name,
      center: cell.center,
      origin: cell.shape === "sector" ? input.warehouse : undefined,
      shape: cell.shape,
      cellSizeKm: cell.cellSizeKm || undefined,
      mainRadiusKm: cell.mainRadiusKm,
      radiusKm: cell.radiusKm,
      sectorStartDeg: cell.sectorStartDeg,
      sectorEndDeg: cell.sectorEndDeg,
      sectorCount: plan.length,
      description: cell.description,
      status: "active" as const,
      createdBy: input.userId,
      updatedBy: input.userId,
    }))
  );

  return created;
}

export async function regenerateClustersForBranch(
  branchId: string,
  userId: Types.ObjectId | string,
  options?: {
    sectorCount?: number;
    mainRadiusKm?: number;
    expandedRegions?: DeliveryExpandedRegion[] | null;
  }
) {
  const { Branch } = await import("../models/Branch.model");
  const branch = await Branch.findOne({ _id: branchId, deletedAt: null });
  if (!branch) throw new Error("Branch not found");
  if (branch.parentBranchId) throw new Error("Only main branches have delivery cluster grids");

  const warehouse = await resolveBranchWarehouseCenter(branch);
  if (!branch.gpsCoordinates?.lat) {
    branch.gpsCoordinates = warehouse;
  }

  const count = options?.sectorCount ?? branch.deliveryClusterCount ?? DEFAULT_CLUSTER_SECTOR_COUNT;
  const mainRadiusKm = options?.mainRadiusKm ?? branch.deliveryRadiusKm ?? MAIN_SERVICE_RADIUS_KM;
  branch.deliveryClusterCount = count;
  branch.deliveryRadiusKm = mainRadiusKm;
  if (options && "expandedRegions" in options) {
    branch.deliveryExpandedRegions = options.expandedRegions?.length
      ? options.expandedRegions
      : undefined;
  }
  await branch.save();

  return createDefaultClustersForBranch({
    companyId: branch.companyId,
    branchId: branch._id,
    branchCode: branch.code,
    branchName: branch.name,
    warehouse,
    userId,
    replaceExisting: true,
    sectorCount: count,
    mainRadiusKm,
    expandedRegions: branch.deliveryExpandedRegions ?? null,
  });
}
