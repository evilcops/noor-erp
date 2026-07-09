import { Branch } from "../models/Branch.model";

const DEFAULT_WAREHOUSE = { lat: 23.588, lng: 58.3829 };

/** Main branch id plus all sub-branch ids under it. */
export async function expandMainBranchIds(mainId: string): Promise<string[]> {
  const subs = await Branch.find({ parentBranchId: mainId, deletedAt: null }).select("_id").lean();
  return [mainId, ...subs.map((b) => String(b._id))];
}

export function branchIdFilter(mainId: string, ids: string[]) {
  return ids.length === 1 ? mainId : { $in: ids };
}

export async function getBranchWarehousePoint(branchId: unknown) {
  if (!branchId) return DEFAULT_WAREHOUSE;
  const branch = await Branch.findById(branchId).select("gpsCoordinates").lean();
  return branch?.gpsCoordinates ?? DEFAULT_WAREHOUSE;
}
