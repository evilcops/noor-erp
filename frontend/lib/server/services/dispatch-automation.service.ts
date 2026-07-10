import { Delivery } from "../models/Delivery.model";
import { DISPATCH_CONFIG } from "../config/dispatch.config";

/** Auto-advance orders past prep time to ready_for_dispatch */
export async function autoAdvanceWarehousePrep(companyId: string, branchId: string) {
  const readyCutoff = new Date(Date.now() - DISPATCH_CONFIG.prepMinutes * 60_000);

  const prepResult = await Delivery.updateMany(
    {
      companyId,
      branchId,
      deletedAt: null,
      warehouseStatus: { $in: ["order_confirmed", "picking", "packing"] },
      createdAt: { $lte: readyCutoff },
    },
    { warehouseStatus: "ready_for_dispatch" }
  );

  const riderWaiting = await Delivery.updateMany(
    {
      companyId,
      branchId,
      deletedAt: null,
      warehouseStatus: "ready_for_dispatch",
      status: "scheduled",
      riderId: { $exists: true },
      assignmentLocked: false,
    },
    { warehouseStatus: "waiting_for_rider" }
  );

  return {
    advancedToReady: prepResult.modifiedCount,
    markedWaitingForRider: riderWaiting.modifiedCount,
  };
}
