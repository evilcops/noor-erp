import type { Types } from "mongoose";
import { Delivery } from "../models/Delivery.model";
import { AppError } from "../utils/AppError";

export async function assertNoTimeSlotConflict(input: {
  riderId: Types.ObjectId | string;
  scheduledDate: Date;
  timeSlotStart: Date;
  timeSlotEnd: Date;
  excludeDeliveryId?: Types.ObjectId | string;
}) {
  if (input.timeSlotStart >= input.timeSlotEnd) {
    throw new AppError("BAD_REQUEST", "Time slot end must be after start", 400);
  }

  const dayStart = new Date(input.scheduledDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(input.scheduledDate);
  dayEnd.setHours(23, 59, 59, 999);

  const filter: Record<string, unknown> = {
    riderId: input.riderId,
    scheduledDate: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ["scheduled", "in_transit"] },
    deletedAt: null,
    timeSlotStart: { $lt: input.timeSlotEnd },
    timeSlotEnd: { $gt: input.timeSlotStart },
  };

  if (input.excludeDeliveryId) {
    filter._id = { $ne: input.excludeDeliveryId };
  }

  const conflict = await Delivery.findOne(filter).lean();
  if (conflict) {
    throw new AppError(
      "CONFLICT",
      `Rider already has delivery ${conflict.deliveryNumber} in this time slot`,
      409
    );
  }
}

export function computePriorityScore(input: {
  totalAmount: number;
  quantity: number;
  priority: "low" | "normal" | "high" | "urgent";
  areaDemandScore?: number;
}): number {
  const priorityBase = { low: 20, normal: 50, high: 75, urgent: 95 }[input.priority];
  const valueScore = Math.min(30, input.totalAmount / 10);
  const qtyScore = Math.min(20, input.quantity * 2);
  const demandScore = (input.areaDemandScore ?? 50) * 0.3;
  return Math.round(priorityBase * 0.4 + valueScore + qtyScore + demandScore);
}

/** Shift lower-priority deliveries by 1–2 hours when a high-priority order arrives */
export async function rebalanceTimeSlots(input: {
  riderId: Types.ObjectId | string;
  scheduledDate: Date;
  newPriorityScore: number;
  newSlotStart: Date;
  newSlotEnd: Date;
}) {
  const dayStart = new Date(input.scheduledDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(input.scheduledDate);
  dayEnd.setHours(23, 59, 59, 999);

  const overlapping = await Delivery.find({
    riderId: input.riderId,
    scheduledDate: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ["scheduled", "in_transit"] },
    deletedAt: null,
    timeSlotStart: { $lt: input.newSlotEnd },
    timeSlotEnd: { $gt: input.newSlotStart },
    priorityScore: { $lt: input.newPriorityScore },
  }).sort({ priorityScore: 1 });

  for (const delivery of overlapping) {
    if (!delivery.timeSlotStart || !delivery.timeSlotEnd) continue;
    const duration =
      delivery.timeSlotEnd.getTime() - delivery.timeSlotStart.getTime();
    const shiftMs = duration <= 3600000 ? 3600000 : 7200000;
    delivery.timeSlotStart = new Date(delivery.timeSlotStart.getTime() + shiftMs);
    delivery.timeSlotEnd = new Date(delivery.timeSlotEnd.getTime() + shiftMs);
    delivery.status = "rescheduled";
    delivery.notes = [
      delivery.notes,
      "Automatically rescheduled due to higher-priority delivery in same window.",
    ]
      .filter(Boolean)
      .join("\n");
    await delivery.save();
  }
}
