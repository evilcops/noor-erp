import mongoose from "mongoose";
import { RefusedItem } from "../models/RefusedItem.model";
import { Delivery } from "../models/Delivery.model";
import { Sale } from "../models/Sale.model";
import { syncProductStockStatus, updateStockLevel } from "./inventory.service";
import { AppError } from "../utils/AppError";

export async function createRefusedItemsFromDelivery(
  deliveryId: string,
  opts?: { reason?: string; userId?: string }
) {
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery || delivery.deletedAt) {
    throw new AppError("NOT_FOUND", "Delivery not found", 404);
  }

  const existing = await RefusedItem.countDocuments({
    deliveryId: delivery._id,
    deletedAt: null,
  });
  if (existing > 0) {
    return RefusedItem.find({ deliveryId: delivery._id, deletedAt: null }).lean();
  }

  const sale = await Sale.findById(delivery.saleId).lean();
  if (!sale) throw new AppError("NOT_FOUND", "Sale not found for delivery", 404);

  const lines =
    sale.items && sale.items.length > 0
      ? sale.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      : [{ productId: sale.productId, quantity: sale.quantity }];

  await RefusedItem.insertMany(
    lines.map((line) => ({
      companyId: delivery.companyId,
      branchId: delivery.branchId,
      deliveryId: delivery._id,
      saleId: sale._id,
      riderId: delivery.riderId,
      productId: line.productId,
      quantity: line.quantity,
      status: "with_rider" as const,
      refuseReason: opts?.reason || delivery.failureReason || "Customer refused",
      deliveryNumber: delivery.deliveryNumber,
      saleNumber: sale.saleNumber,
      createdBy: opts?.userId,
      updatedBy: opts?.userId,
    }))
  );

  return RefusedItem.find({ deliveryId: delivery._id, deletedAt: null }).lean();
}

export async function markRefusedItemsReturnedByRider(riderId: string | mongoose.Types.ObjectId) {
  const result = await RefusedItem.updateMany(
    { riderId, status: "with_rider", deletedAt: null },
    { $set: { status: "at_warehouse", returnedAt: new Date() } }
  );
  return { returned: result.modifiedCount ?? 0 };
}

export async function restockRefusedItem(itemId: string, userId: string, opts?: { notes?: string }) {
  const item = await RefusedItem.findOne({ _id: itemId, deletedAt: null });
  if (!item) throw new AppError("NOT_FOUND", "Refused item not found", 404);
  if (item.status === "restocked") throw new AppError("BAD_REQUEST", "Already restocked", 400);
  if (item.status === "with_rider") {
    throw new AppError("BAD_REQUEST", "Rider must return this to the warehouse first", 400);
  }
  if (item.status === "discarded") {
    throw new AppError("BAD_REQUEST", "Discarded items cannot be restocked", 400);
  }

  await updateStockLevel({
    companyId: item.companyId,
    branchId: item.branchId,
    productId: item.productId,
    quantity: item.quantity,
    type: "returned",
    reason: `Refused delivery ${item.deliveryNumber || item.deliveryId} restocked`,
    notes: opts?.notes,
    referenceType: "RefusedItem",
    referenceId: item._id,
    userId,
  });
  await syncProductStockStatus(item.productId);

  item.status = "restocked";
  item.restockedAt = new Date();
  item.restockedBy = new mongoose.Types.ObjectId(userId);
  if (opts?.notes) item.notes = opts.notes;
  item.updatedBy = new mongoose.Types.ObjectId(userId);
  await item.save();
  return item;
}

export async function discardRefusedItem(itemId: string, userId: string, opts?: { notes?: string }) {
  const item = await RefusedItem.findOne({ _id: itemId, deletedAt: null });
  if (!item) throw new AppError("NOT_FOUND", "Refused item not found", 404);
  if (item.status !== "at_warehouse") {
    throw new AppError("BAD_REQUEST", "Only warehouse items can be discarded", 400);
  }
  item.status = "discarded";
  item.discardedAt = new Date();
  item.updatedBy = new mongoose.Types.ObjectId(userId);
  if (opts?.notes) item.notes = opts.notes;
  await item.save();
  return item;
}
