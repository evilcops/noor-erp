import { Delivery } from "../models/Delivery.model";
import type { ISale } from "../models/Sale.model";
import type { ICustomer } from "../models/Customer.model";
import { geocodeAddress } from "./geocoding.service";
import { getDayOfWeekPriority } from "./route-optimization.service";
import {
  predictDeliveryPromise,
  provisionalAssignRider,
  resolveClusterForPoint,
  runDispatchCycle,
  scheduleFleetOptimise,
  canRiderAcceptNewOrders,
  type OrderSource,
} from "./dispatch-engine.service";
import { computeDispatchPriorityScore } from "./dispatch-priority.service";
import { Rider } from "../models/Rider.model";
import { Branch } from "../models/Branch.model";
import { expandMainBranchIds } from "../utils/branchScope";

/** Keep store-app deliveries on today's operational schedule so riders/dispatch see them. */
export function normalizeStoreAppScheduleDates(input: {
  scheduledDate?: Date | null;
  promisedWindowStart?: Date | null;
  promisedWindowEnd?: Date | null;
  estimatedArrival?: Date | null;
  timeSlotStart?: Date | null;
  timeSlotEnd?: Date | null;
}) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxEta = new Date(now.getTime() + 12 * 60 * 60000);

  const inToday = (d?: Date | null) =>
    Boolean(d && d.getTime() >= todayStart.getTime() && d.getTime() < tomorrow.getTime());

  let scheduledDate = input.scheduledDate ? new Date(input.scheduledDate) : now;
  if (!inToday(scheduledDate)) scheduledDate = now;

  let promisedWindowStart = input.promisedWindowStart
    ? new Date(input.promisedWindowStart)
    : scheduledDate;
  let promisedWindowEnd = input.promisedWindowEnd
    ? new Date(input.promisedWindowEnd)
    : new Date(promisedWindowStart.getTime() + 45 * 60000);
  let estimatedArrival = input.estimatedArrival
    ? new Date(input.estimatedArrival)
    : promisedWindowStart;

  if (promisedWindowStart.getTime() > maxEta.getTime()) promisedWindowStart = scheduledDate;
  if (promisedWindowEnd.getTime() > maxEta.getTime()) {
    promisedWindowEnd = new Date(promisedWindowStart.getTime() + 45 * 60000);
  }
  if (estimatedArrival.getTime() > maxEta.getTime()) estimatedArrival = promisedWindowStart;
  if (estimatedArrival.getTime() < now.getTime()) {
    estimatedArrival = new Date(now.getTime() + 30 * 60000);
  }

  return {
    scheduledDate,
    promisedWindowStart,
    promisedWindowEnd,
    estimatedArrival,
    timeSlotStart: input.timeSlotStart ? new Date(input.timeSlotStart) : promisedWindowStart,
    timeSlotEnd: input.timeSlotEnd ? new Date(input.timeSlotEnd) : promisedWindowEnd,
  };
}

/**
 * Store-app fallback: if normal dispatch finds no rider, assign any usable rider
 * on this branch (or sibling branches under the same main).
 */
export async function ensureStoreAppRiderAssigned(deliveryId: string) {
  let delivery = await Delivery.findById(deliveryId);
  if (!delivery || delivery.deletedAt) return delivery;
  if (["cancelled", "delivered", "refused", "failed"].includes(delivery.status)) {
    return delivery;
  }

  const schedule = normalizeStoreAppScheduleDates({
    scheduledDate: delivery.scheduledDate,
    promisedWindowStart: delivery.promisedWindowStart,
    promisedWindowEnd: delivery.promisedWindowEnd,
    estimatedArrival: delivery.estimatedArrival,
    timeSlotStart: delivery.timeSlotStart,
    timeSlotEnd: delivery.timeSlotEnd,
  });
  delivery.scheduledDate = schedule.scheduledDate;
  delivery.promisedWindowStart = schedule.promisedWindowStart;
  delivery.promisedWindowEnd = schedule.promisedWindowEnd;
  delivery.estimatedArrival = schedule.estimatedArrival;
  delivery.timeSlotStart = schedule.timeSlotStart;
  delivery.timeSlotEnd = schedule.timeSlotEnd;

  if (delivery.riderId) {
    if (delivery.status === "pending_assignment") delivery.status = "scheduled";
    await delivery.save();
    return delivery;
  }

  await delivery.save();
  await provisionalAssignRider(deliveryId);
  delivery = await Delivery.findById(deliveryId);
  if (delivery?.riderId) {
    if (delivery.status === "pending_assignment") {
      delivery.status = "scheduled";
      await delivery.save();
    }
    return delivery;
  }

  const branchIds = await expandMainBranchIds(String(delivery!.branchId));
  const branch = await Branch.findById(delivery!.branchId).select("parentBranchId").lean();
  if (branch?.parentBranchId) {
    const siblings = await expandMainBranchIds(String(branch.parentBranchId));
    for (const id of siblings) {
      if (!branchIds.includes(id)) branchIds.push(id);
    }
  }

  const riders = await Rider.find({
    companyId: delivery!.companyId,
    branchId: { $in: branchIds },
    deletedAt: null,
    status: { $nin: ["inactive"] },
    isOnJourney: false,
  })
    .sort({ isOnShift: -1, status: 1, createdAt: 1 })
    .limit(20);

  for (const rider of riders) {
    if (["on_delivery", "loading"].includes(rider.status)) continue;
    if (!(await canRiderAcceptNewOrders(rider._id))) continue;

    if (!rider.isOnShift || rider.status === "offline" || rider.status === "off_duty") {
      rider.isOnShift = true;
      rider.shiftStartedAt = rider.shiftStartedAt ?? new Date();
      rider.status = "available";
      await rider.save();
    }

    await Delivery.updateOne(
      { _id: delivery!._id },
      {
        $set: {
          riderId: rider._id,
          provisionalRiderId: rider._id,
          status: "scheduled",
          scheduledDate: schedule.scheduledDate,
          promisedWindowStart: schedule.promisedWindowStart,
          promisedWindowEnd: schedule.promisedWindowEnd,
          estimatedArrival: schedule.estimatedArrival,
          timeSlotStart: schedule.timeSlotStart,
          timeSlotEnd: schedule.timeSlotEnd,
        },
      }
    );
    return Delivery.findById(delivery!._id)
      .populate("riderId", "riderCode status")
      .populate("clusterId", "code name")
      .lean();
  }

  // Last resort: any non-inactive rider on company for this branch tree
  const anyRider = await Rider.findOne({
    companyId: delivery!.companyId,
    branchId: { $in: branchIds },
    deletedAt: null,
    status: { $ne: "inactive" },
  }).sort({ createdAt: 1 });

  if (anyRider) {
    anyRider.isOnShift = true;
    anyRider.isOnJourney = false;
    anyRider.shiftStartedAt = anyRider.shiftStartedAt ?? new Date();
    anyRider.status = "available";
    await anyRider.save();

    await Delivery.updateOne(
      { _id: delivery!._id },
      {
        $set: {
          riderId: anyRider._id,
          provisionalRiderId: anyRider._id,
          status: "scheduled",
          scheduledDate: schedule.scheduledDate,
          promisedWindowStart: schedule.promisedWindowStart,
          promisedWindowEnd: schedule.promisedWindowEnd,
          estimatedArrival: schedule.estimatedArrival,
          timeSlotStart: schedule.timeSlotStart,
          timeSlotEnd: schedule.timeSlotEnd,
        },
      }
    );
  }

  return Delivery.findById(delivery!._id)
    .populate("riderId", "riderCode status")
    .populate("clusterId", "code name")
    .lean();
}

export async function generateDeliveryNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEL-${year}-`;
  const last = await Delivery.findOne({
    companyId,
    deliveryNumber: new RegExp(`^${prefix}`),
  })
    .sort({ deliveryNumber: -1 })
    .select("deliveryNumber")
    .lean();
  const next = last?.deliveryNumber
    ? parseInt(last.deliveryNumber.split("-").pop() ?? "0", 10) + 1
    : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

async function buildHistoricalDemandMap(companyId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deliveries = await Delivery.find({
    companyId,
    createdAt: { $gte: thirtyDaysAgo },
    area: { $exists: true, $ne: "" },
    deletedAt: null,
  })
    .select("area scheduledDate createdAt")
    .lean();

  const map = new Map<string, number>();
  for (const d of deliveries) {
    const date = d.scheduledDate ?? d.createdAt;
    const dow = new Date(date).getDay();
    const key = `${(d.area ?? "").toLowerCase()}:${dow}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export async function createDeliveryFromSale(
  sale: ISale,
  customer: ICustomer,
  createdBy: string,
  options?: {
    orderSource?: OrderSource;
    acceptPromise?: boolean;
    promisedWindowStart?: Date;
    promisedWindowEnd?: Date;
  }
) {
  const existing = await Delivery.findOne({ saleId: sale._id, deletedAt: null });
  if (existing) return existing;

  let coordinates = customer.coordinates;
  if (!coordinates && customer.address) {
    coordinates = (await geocodeAddress(customer.address)) ?? undefined;
  }

  const demandMap = await buildHistoricalDemandMap(String(sale.companyId));
  const dow = new Date().getDay();
  const demandScore = getDayOfWeekPriority(customer.area, dow, demandMap);

  const promise = await predictDeliveryPromise({
    companyId: String(sale.companyId),
    branchId: String(sale.branchId),
    coordinates,
    totalAmount: sale.totalAmount,
    quantity: sale.quantity,
  });

  const cluster = await resolveClusterForPoint(
    String(sale.companyId),
    String(sale.branchId),
    coordinates
  );

  const deliveryNumber = await generateDeliveryNumber(String(sale.companyId));
  let promisedWindowStart = options?.promisedWindowStart ?? promise.promisedWindowStart;
  let promisedWindowEnd = options?.promisedWindowEnd ?? promise.promisedWindowEnd;
  let estimatedArrival = promise.estimatedDeliveryAt;
  let scheduledDate = promisedWindowStart;
  let timeSlotStart = promisedWindowStart;
  let timeSlotEnd = promisedWindowEnd;

  if ((options?.orderSource ?? "new_order") === "store_app") {
    const normalized = normalizeStoreAppScheduleDates({
      scheduledDate,
      promisedWindowStart,
      promisedWindowEnd,
      estimatedArrival,
      timeSlotStart,
      timeSlotEnd,
    });
    scheduledDate = normalized.scheduledDate;
    promisedWindowStart = normalized.promisedWindowStart;
    promisedWindowEnd = normalized.promisedWindowEnd;
    estimatedArrival = normalized.estimatedArrival;
    timeSlotStart = normalized.timeSlotStart;
    timeSlotEnd = normalized.timeSlotEnd;
  }

  const priorityScore = computeDispatchPriorityScore({
    priority: "normal",
    totalAmount: sale.totalAmount,
    quantity: sale.quantity,
    promisedWindowEnd,
    promisedWindowStart,
    createdAt: new Date(),
    areaDemandScore: demandScore,
  });

  const queueCount = await Delivery.countDocuments({
    companyId: sale.companyId,
    branchId: sale.branchId,
    deletedAt: null,
    warehouseStatus: { $nin: ["dispatched"] },
    status: { $nin: ["delivered", "cancelled"] },
  });

  let initialRiderId = promise.provisionalRiderId;
  if (initialRiderId && !(await canRiderAcceptNewOrders(initialRiderId))) {
    initialRiderId = undefined;
  }

  const delivery = await Delivery.create({
    companyId: sale.companyId,
    branchId: sale.branchId,
    saleId: sale._id,
    customerId: customer._id,
    deliveryNumber,
    orderSource: options?.orderSource ?? "new_order",
    status: "pending_assignment",
    warehouseStatus: "order_confirmed",
    priority: "normal",
    priorityScore,
    promisedWindowStart,
    promisedWindowEnd,
    promiseAcceptedAt: options?.acceptPromise !== false ? new Date() : undefined,
    preparationMinutes: promise.preparationMinutes,
    warehouseReadyAt: promise.warehouseReadyAt,
    travelTimeMinutes: promise.travelTimeMinutes,
    estimatedArrival,
    timeSlotStart,
    timeSlotEnd,
    scheduledDate,
    provisionalRiderId: initialRiderId,
    riderId: initialRiderId,
    clusterId: cluster?._id,
    deliveryAddress: customer.address,
    area: customer.area,
    coordinates,
    queuePosition: queueCount + 1,
    createdBy,
    updatedBy: createdBy,
  });

  await provisionalAssignRider(String(delivery._id));

  await runDispatchCycle({
    companyId: String(sale.companyId),
    branchId: String(sale.branchId),
    trigger: "new_order",
  });

  if ((options?.orderSource ?? "new_order") === "store_app") {
    const withRider = await ensureStoreAppRiderAssigned(String(delivery._id));
    if (withRider) return withRider;
  }

  const finalDelivery = await Delivery.findById(delivery._id)
    .populate("riderId", "riderCode status")
    .populate("clusterId", "code name")
    .lean();

  return finalDelivery ?? delivery;
}

export function buildWhatsAppOrderLink(phone: string, message: string): string {
  const normalized = phone.replace(/\D/g, "");
  const withCountry = normalized.startsWith("968") ? normalized : `968${normalized}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
