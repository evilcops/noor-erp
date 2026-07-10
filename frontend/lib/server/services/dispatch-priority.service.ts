import { Delivery } from "../models/Delivery.model";
import { DISPATCH_CONFIG } from "../config/dispatch.config";
import { computePriorityScore } from "./delivery-scheduling.service";
import type { DeliveryPriority } from "../models/Delivery.model";

type QueueDelivery = {
  _id: { toString(): string };
  priority?: DeliveryPriority;
  priorityScore?: number;
  promisedWindowEnd?: Date;
  promisedWindowStart?: Date;
  createdAt?: Date;
  saleId?: { totalAmount?: number; quantity?: number } | unknown;
};

function saleAmount(saleId: QueueDelivery["saleId"]): number {
  if (saleId && typeof saleId === "object" && "totalAmount" in saleId) {
    return (saleId as { totalAmount?: number }).totalAmount ?? 0;
  }
  return 0;
}

function saleQuantity(saleId: QueueDelivery["saleId"]): number {
  if (saleId && typeof saleId === "object" && "quantity" in saleId) {
    return (saleId as { quantity?: number }).quantity ?? 1;
  }
  return 1;
}

/** Dynamic score: ETA urgency + order value + queue waiting time */
export function computeDispatchPriorityScore(input: {
  priority: DeliveryPriority;
  totalAmount: number;
  quantity: number;
  promisedWindowEnd?: Date;
  promisedWindowStart?: Date;
  createdAt?: Date;
  areaDemandScore?: number;
}): number {
  const now = Date.now();
  const windowEnd = input.promisedWindowEnd ?? input.promisedWindowStart;
  let etaUrgency = 40;
  if (windowEnd) {
    const minutesToDeadline = (new Date(windowEnd).getTime() - now) / 60_000;
    if (minutesToDeadline <= 0) etaUrgency = 100;
    else if (minutesToDeadline <= 30) etaUrgency = 95;
    else if (minutesToDeadline <= 60) etaUrgency = 80;
    else if (minutesToDeadline <= 120) etaUrgency = 60;
    else etaUrgency = Math.max(20, 50 - minutesToDeadline / 10);
  }

  const waitingMinutes = input.createdAt
    ? Math.max(0, (now - new Date(input.createdAt).getTime()) / 60_000)
    : 0;
  const waitingScore = Math.min(100, waitingMinutes * 1.2);
  const valueScore = Math.min(100, (input.totalAmount / DISPATCH_CONFIG.highValueThreshold) * 100);

  const base = computePriorityScore({
    totalAmount: input.totalAmount,
    quantity: input.quantity,
    priority: input.priority,
    areaDemandScore: input.areaDemandScore,
  });

  const w = DISPATCH_CONFIG.priorityWeights;
  const blended = Math.round(
    w.eta * etaUrgency + w.value * valueScore + w.waiting * waitingScore + base * 0.15
  );

  return Math.min(100, Math.max(1, blended));
}

/** Re-score all open warehouse queue orders before assignment */
export async function refreshQueuePriorities(companyId: string, branchId: string) {
  const open = await Delivery.find({
    companyId,
    branchId,
    deletedAt: null,
    status: { $nin: ["delivered", "cancelled"] },
    warehouseStatus: { $nin: ["dispatched"] },
    assignmentLocked: false,
  })
    .populate("saleId", "totalAmount quantity")
    .lean();

  const bulk: { updateOne: { filter: { _id: unknown }; update: { priorityScore: number } } }[] =
    [];

  for (const d of open as QueueDelivery[]) {
    const score = computeDispatchPriorityScore({
      priority: d.priority ?? "normal",
      totalAmount: saleAmount(d.saleId),
      quantity: saleQuantity(d.saleId),
      promisedWindowEnd: d.promisedWindowEnd,
      promisedWindowStart: d.promisedWindowStart,
      createdAt: d.createdAt,
    });
    bulk.push({
      updateOne: {
        filter: { _id: d._id },
        update: { priorityScore: score },
      },
    });
  }

  if (bulk.length) {
    await Delivery.bulkWrite(bulk);
  }

  return bulk.length;
}

export function compareDeliveriesByDispatchPriority(
  a: { priorityScore?: number; promisedWindowStart?: Date; createdAt?: Date; saleId?: QueueDelivery["saleId"] },
  b: { priorityScore?: number; promisedWindowStart?: Date; createdAt?: Date; saleId?: QueueDelivery["saleId"] }
): number {
  const scoreDiff = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  if (Math.abs(scoreDiff) > 3) return scoreDiff;

  const aEnd = a.promisedWindowStart?.getTime() ?? 0;
  const bEnd = b.promisedWindowStart?.getTime() ?? 0;
  const etaGapMin = Math.abs(aEnd - bEnd) / 60_000;
  if (etaGapMin <= DISPATCH_CONFIG.etaTieBreakMinutes) {
    const valueDiff = saleAmount(b.saleId) - saleAmount(a.saleId);
    if (valueDiff !== 0) return valueDiff > 0 ? 1 : -1;
  }

  if (aEnd !== bEnd) return aEnd - bEnd;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  return aCreated - bCreated;
}
