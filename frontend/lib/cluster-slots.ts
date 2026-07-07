export const MIN_CLUSTER_SECTOR_COUNT = 2;
export const MIN_EXPANDED_REGION_CLUSTER_COUNT = 1;
export const MAX_CLUSTER_SECTOR_COUNT = 24;
export const DEFAULT_CLUSTER_SECTOR_COUNT = 5;

const COMPASS_FIVE = ["North", "North-East", "South-East", "South-West", "North-West"];

export function sectorLabelForIndex(index: number, sectorCount: number): string {
  if (sectorCount === 5 && COMPASS_FIVE[index]) return COMPASS_FIVE[index];
  return `Sector ${index + 1}`;
}

export function sectorIndexFromStartDeg(sectorStartDeg: number, sectorCount: number): number {
  const sliceDeg = 360 / sectorCount;
  const index = Math.round(sectorStartDeg / sliceDeg);
  return Math.min(Math.max(index, 0), sectorCount - 1);
}

export function sectorLabelFromCluster(
  sectorStartDeg?: number,
  sectorCount?: number
): string | null {
  if (sectorStartDeg == null || !sectorCount) return null;
  return sectorLabelForIndex(sectorIndexFromStartDeg(sectorStartDeg, sectorCount), sectorCount);
}

export function buildSectorSlotOptions(
  sectorCount: number,
  usedIndices: Set<number>
): { value: string; label: string; disabled?: boolean }[] {
  const sliceDeg = 360 / sectorCount;
  return Array.from({ length: sectorCount }, (_, index) => {
    const start = (index * sliceDeg).toFixed(0);
    const end = ((index + 1) * sliceDeg).toFixed(0);
    const label = `${sectorLabelForIndex(index, sectorCount)} (${start}°–${end}°)`;
    return {
      value: String(index),
      label: usedIndices.has(index) ? `${label} — in use` : label,
      disabled: usedIndices.has(index),
    };
  });
}
