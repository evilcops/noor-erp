import { Delivery } from "../models/Delivery.model";
import type { ISale } from "../models/Sale.model";
import type { ICustomer } from "../models/Customer.model";
import { geocodeAddress } from "./geocoding.service";
import { computePriorityScore } from "./delivery-scheduling.service";
import { getDayOfWeekPriority } from "./route-optimization.service";
import {
  predictDeliveryPromise,
  provisionalAssignRider,
  resolveClusterForPoint,
  optimiseFleetPlan,
  type OrderSource,
} from "./dispatch-engine.service";

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
  const priorityScore = computePriorityScore({
    totalAmount: sale.totalAmount,
    quantity: sale.quantity,
    priority: "normal",
    areaDemandScore: demandScore,
  });

  const queueCount = await Delivery.countDocuments({
    companyId: sale.companyId,
    branchId: sale.branchId,
    deletedAt: null,
    warehouseStatus: { $nin: ["dispatched"] },
    status: { $nin: ["delivered", "cancelled"] },
  });

  const promisedWindowStart = options?.promisedWindowStart ?? promise.promisedWindowStart;
  const promisedWindowEnd = options?.promisedWindowEnd ?? promise.promisedWindowEnd;

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
    timeSlotStart: promisedWindowStart,
    timeSlotEnd: promisedWindowEnd,
    scheduledDate: promisedWindowStart,
    provisionalRiderId: promise.provisionalRiderId,
    riderId: promise.provisionalRiderId,
    clusterId: cluster?._id,
    deliveryAddress: customer.address,
    area: customer.area,
    coordinates,
    queuePosition: queueCount + 1,
    createdBy,
    updatedBy: createdBy,
  });

  await provisionalAssignRider(String(delivery._id));

  await optimiseFleetPlan({
    companyId: String(sale.companyId),
    branchId: String(sale.branchId),
    trigger: "new_order",
  });

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
