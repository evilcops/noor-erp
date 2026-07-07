export const COMPASS_DIRECTIONS = [
  { value: "north", label: "North", bearingDeg: 0 },
  { value: "north_east", label: "North-East", bearingDeg: 45 },
  { value: "east", label: "East", bearingDeg: 90 },
  { value: "south_east", label: "South-East", bearingDeg: 135 },
  { value: "south", label: "South", bearingDeg: 180 },
  { value: "south_west", label: "South-West", bearingDeg: 225 },
  { value: "west", label: "West", bearingDeg: 270 },
  { value: "north_west", label: "North-West", bearingDeg: 315 },
] as const;

export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number]["value"];

export const COMPASS_DIRECTION_OPTIONS = COMPASS_DIRECTIONS.map((d) => ({
  value: d.value,
  label: d.label,
}));

export function directionBearingDeg(direction: CompassDirection): number {
  const match = COMPASS_DIRECTIONS.find((d) => d.value === direction);
  if (!match) throw new Error(`Invalid direction: ${direction}`);
  return match.bearingDeg;
}

export function directionLabel(direction: CompassDirection): string {
  return COMPASS_DIRECTIONS.find((d) => d.value === direction)?.label ?? direction;
}

/** Clockwise degrees from `fromDeg` to `toDeg` (0–360, exclusive of full duplicate). */
export function clockwiseSpanDeg(fromDeg: number, toDeg: number): number {
  const span = (toDeg - fromDeg + 360) % 360;
  return span === 0 ? 360 : span;
}

/**
 * Shorter arc between two compass bearings (e.g. North & West → 90° through North-West).
 */
export function shortArcBetweenDeg(fromDeg: number, toDeg: number): { startDeg: number; spanDeg: number } {
  const clockwise = clockwiseSpanDeg(fromDeg, toDeg);
  if (clockwise <= 180) {
    return { startDeg: fromDeg, spanDeg: clockwise };
  }
  return { startDeg: toDeg, spanDeg: 360 - clockwise };
}

export function shortArcBetweenDirections(
  fromDirection: CompassDirection,
  toDirection: CompassDirection
): { startDeg: number; spanDeg: number } {
  return shortArcBetweenDeg(
    directionBearingDeg(fromDirection),
    directionBearingDeg(toDirection)
  );
}

export function arcLabel(fromDirection: CompassDirection, toDirection: CompassDirection): string {
  const { spanDeg } = shortArcBetweenDirections(fromDirection, toDirection);
  return `Between ${directionLabel(fromDirection)} and ${directionLabel(toDirection)} (${spanDeg}°)`;
}

export interface DeliveryExpandedRegion {
  fromDirection: CompassDirection;
  toDirection: CompassDirection;
  radiusKm: number;
  clusterCount: number;
}

export function regionKey(region: Pick<DeliveryExpandedRegion, "fromDirection" | "toDirection">): string {
  return `${region.fromDirection}:${region.toDirection}`;
}

export function regionsEqual(a: DeliveryExpandedRegion[], b: DeliveryExpandedRegion[]): boolean {
  if (a.length !== b.length) return false;
  const sortKeys = (list: DeliveryExpandedRegion[]) =>
    [...list]
      .map((r) => `${regionKey(r)}:${r.radiusKm}:${r.clusterCount}`)
      .sort()
      .join("|");
  return sortKeys(a) === sortKeys(b);
}

export function expandedRegionToArc(region: DeliveryExpandedRegion) {
  const { startDeg, spanDeg } = shortArcBetweenDirections(region.fromDirection, region.toDirection);
  return {
    ...region,
    startDeg,
    spanDeg,
    label: arcLabel(region.fromDirection, region.toDirection),
  };
}

export function validateExpandedRegionsNoOverlap(regions: DeliveryExpandedRegion[]): void {
  if (regions.length <= 1) return;
  const arcs = regions.map(expandedRegionToArc).sort((a, b) => a.startDeg - b.startDeg);
  for (let i = 0; i < arcs.length - 1; i++) {
    if (arcs[i].startDeg + arcs[i].spanDeg > arcs[i + 1].startDeg) {
      throw new Error(
        `Expanded regions overlap: ${arcs[i].label} and ${arcs[i + 1].label}`
      );
    }
  }
  const last = arcs[arcs.length - 1];
  const first = arcs[0];
  const lastEnd = (last.startDeg + last.spanDeg) % 360;
  if (lastEnd > first.startDeg) {
    throw new Error(`Expanded regions overlap: ${last.label} and ${first.label}`);
  }
}
