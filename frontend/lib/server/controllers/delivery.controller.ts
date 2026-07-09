import type { Request, Response } from "express";
import { Delivery } from "../models/Delivery.model";
import { Rider } from "../models/Rider.model";
import { RiderJourney } from "../models/RiderJourney.model";
import { Sale } from "../models/Sale.model";
import { buildTenantFilter } from "../services/permission.service";
import {
  assertNoTimeSlotConflict,
  rebalanceTimeSlots,
  computePriorityScore,
} from "../services/delivery-scheduling.service";
import { optimizeRoute } from "../services/route-optimization.service";
import { buildWhatsAppOrderLink } from "../services/delivery.service";
import { advanceWarehouseStatus, optimiseFleetPlan, handleCustomerUnavailable, provisionalAssignRider } from "../services/dispatch-engine.service";
import { buildRiderRoutePlan } from "../services/rider-route.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { deliveryInDateRangeQuery, formatLocalDate, parseDeliveryDateRange } from "../utils/deliveryDateFilter";
import { branchIdFilter, expandMainBranchIds, getBranchWarehousePoint } from "../utils/branchScope";

async function getAuthenticatedRider(req: Request) {
  if (req.user!.role !== "rider") {
    throw new AppError("FORBIDDEN", "Rider login required", 403);
  }
  if (!req.user!.employeeId) {
    throw new AppError("FORBIDDEN", "Rider account is not linked to an employee profile", 403);
  }
  const tenant = buildTenantFilter(req.user!);
  const rider = await Rider.findOne({
    employeeId: req.user!.employeeId,
    ...tenant,
    deletedAt: null,
  });
  if (!rider) {
    throw new AppError("FORBIDDEN", "You are not registered as a rider", 403);
  }
  return rider;
}

async function assertRiderOwnsDelivery(req: Request, delivery: { riderId?: unknown }) {
  if (req.user!.role !== "rider") return;
  const rider = await getAuthenticatedRider(req);
  if (String(delivery.riderId) !== String(rider._id)) {
    throw new AppError("FORBIDDEN", "You can only update your own deliveries", 403);
  }
}

export async function listDeliveries(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.riderId) filter.riderId = req.query.riderId;
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.dateFrom || req.query.dateTo) {
    const { start, end } = parseDeliveryDateRange(req.query as Record<string, unknown>);
    Object.assign(filter, deliveryInDateRangeQuery(start, end));
  } else if (req.query.scheduledDate) {
    const day = new Date(String(req.query.scheduledDate));
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    filter.scheduledDate = { $gte: day, $lte: dayEnd };
  }
  if (req.query.search) {
    filter.$or = [
      { deliveryNumber: new RegExp(String(req.query.search), "i") },
      { area: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Delivery.find(filter)
      .populate("customerId", "name phone address area coordinates")
      .populate("riderId")
      .populate("saleId", "saleNumber quantity totalAmount productId")
      .populate("branchId", "name code")
      .sort(buildSortQuery(sortBy ?? "scheduledDate", sortOrder ?? "asc"))
      .skip(skip)
      .limit(limit)
      .lean(),
    Delivery.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getDelivery(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const delivery = await Delivery.findOne({ _id: req.params.id, ...tenant, deletedAt: null })
    .populate("customerId", "name phone email address area coordinates")
    .populate("riderId")
    .populate("saleId")
    .populate({ path: "saleId", populate: { path: "productId", select: "name sku unitOfMeasure" } })
    .populate("branchId", "name code address gpsCoordinates")
    .lean();

  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found", 404);
  return sendSuccess(res, delivery);
}

export async function assignDelivery(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const delivery = await Delivery.findOne({ _id: req.params.id, ...tenant, deletedAt: null });
  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found", 404);

  const { riderId, scheduledDate, timeSlotStart, timeSlotEnd, priority } = req.body as {
    riderId: string;
    scheduledDate: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    priority?: "low" | "normal" | "high" | "urgent";
  };

  const rider = await Rider.findOne({ _id: riderId, ...tenant, deletedAt: null });
  if (!rider) throw new AppError("NOT_FOUND", "Rider not found", 404);

  const slotStart = new Date(timeSlotStart);
  const slotEnd = new Date(timeSlotEnd);
  const schedDate = new Date(scheduledDate);
  schedDate.setHours(0, 0, 0, 0);

  await assertNoTimeSlotConflict({
    riderId,
    scheduledDate: schedDate,
    timeSlotStart: slotStart,
    timeSlotEnd: slotEnd,
    excludeDeliveryId: delivery._id,
  });

  const sale = await Sale.findById(delivery.saleId).lean();
  const priorityLevel = priority ?? delivery.priority;
  const priorityScore = computePriorityScore({
    totalAmount: sale?.totalAmount ?? 0,
    quantity: sale?.quantity ?? 1,
    priority: priorityLevel,
  });

  await rebalanceTimeSlots({
    riderId,
    scheduledDate: schedDate,
    newPriorityScore: priorityScore,
    newSlotStart: slotStart,
    newSlotEnd: slotEnd,
  });

  delivery.riderId = rider._id;
  delivery.scheduledDate = schedDate;
  delivery.timeSlotStart = slotStart;
  delivery.timeSlotEnd = slotEnd;
  delivery.status = "scheduled";
  delivery.priority = priorityLevel;
  delivery.priorityScore = priorityScore;
  delivery.updatedBy = req.user!._id;
  await delivery.save();

  const populated = await Delivery.findById(delivery._id)
    .populate("customerId", "name phone address area coordinates")
    .populate("riderId")
    .populate("saleId", "saleNumber quantity totalAmount")
    .lean();

  return sendSuccess(res, populated);
}

/** Try automatic rider assignment for an unassigned delivery */
export async function autoAssignDelivery(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const delivery = await Delivery.findOne({ _id: req.params.id, ...tenant, deletedAt: null });
  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found", 404);

  if (delivery.assignmentLocked) {
    throw new AppError("BAD_REQUEST", "This delivery assignment is locked", 400);
  }

  await provisionalAssignRider(String(delivery._id));

  await optimiseFleetPlan({
    companyId: String(delivery.companyId),
    branchId: String(delivery.branchId),
    trigger: "auto_assign",
  });

  const updated = await Delivery.findById(delivery._id)
    .populate("customerId", "name phone address area")
    .populate("riderId", "riderCode status")
    .populate("saleId", "saleNumber quantity totalAmount")
    .lean();

  if (!updated?.riderId) {
    throw new AppError(
      "BAD_REQUEST",
      "No available rider found for this branch. Add a rider, set status to Available, and try again — or assign manually.",
      400
    );
  }

  return sendSuccess(res, updated);
}

export async function updateDeliveryStatus(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const delivery = await Delivery.findOne({ _id: req.params.id, ...tenant, deletedAt: null });
  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found", 404);

  await assertRiderOwnsDelivery(req, delivery);

  const body = req.body as {
    status: string;
    failureReason?: string;
    notes?: string;
    cashCollected?: number;
    cashHandedOver?: boolean;
    wastageItems?: { productId: string; quantity: number; reason?: string }[];
    rescheduleTimeSlotStart?: string;
    rescheduleTimeSlotEnd?: string;
  };

  delivery.status = body.status as typeof delivery.status;
  if (body.failureReason) delivery.failureReason = body.failureReason;
  if (body.notes) delivery.notes = body.notes;
  if (body.cashCollected !== undefined) delivery.cashCollected = body.cashCollected;
  if (body.cashHandedOver !== undefined) delivery.cashHandedOver = body.cashHandedOver;
  if (body.wastageItems?.length) {
    delivery.wastageItems = body.wastageItems as unknown as typeof delivery.wastageItems;
  }
  if (body.status === "delivered") delivery.actualDeliveryAt = new Date();

  if (body.status === "rescheduled" && body.rescheduleTimeSlotStart && body.rescheduleTimeSlotEnd) {
    const slotStart = new Date(body.rescheduleTimeSlotStart);
    const slotEnd = new Date(body.rescheduleTimeSlotEnd);
    if (delivery.riderId) {
      await assertNoTimeSlotConflict({
        riderId: delivery.riderId,
        scheduledDate: delivery.scheduledDate ?? new Date(),
        timeSlotStart: slotStart,
        timeSlotEnd: slotEnd,
        excludeDeliveryId: delivery._id,
      });
    }
    delivery.timeSlotStart = slotStart;
    delivery.timeSlotEnd = slotEnd;
    delivery.status = "scheduled";
  }

  delivery.updatedBy = req.user!._id;
  await delivery.save();

  if (body.status === "failed" && body.failureReason === "customer_unavailable") {
    await handleCustomerUnavailable(String(delivery._id));
  }

  if (["delivered", "cancelled", "failed", "refused", "rescheduled"].includes(body.status)) {
    void optimiseFleetPlan({
      companyId: String(delivery.companyId),
      branchId: String(delivery.branchId),
      trigger: `delivery_${body.status}`,
    });
  }

  const populated = await Delivery.findById(delivery._id)
    .populate("customerId", "name phone")
    .populate("saleId", "saleNumber totalAmount")
    .lean();

  return sendSuccess(res, populated);
}

export async function optimizeRiderRoute(req: Request, res: Response) {
  const { riderId, scheduledDate, deliveryIds } = req.body as {
    riderId: string;
    scheduledDate: string;
    deliveryIds: string[];
  };

  const tenant = buildTenantFilter(req.user!);
  const rider = await Rider.findOne({ _id: riderId, ...tenant, deletedAt: null });
  if (!rider) throw new AppError("NOT_FOUND", "Rider not found", 404);

  const origin = await getBranchWarehousePoint(rider.branchId);

  const deliveries = await Delivery.find({
    _id: { $in: deliveryIds },
    riderId: rider._id,
    deletedAt: null,
  }).lean();

  const stops = deliveries
    .filter((d) => d.coordinates?.lat && d.coordinates?.lng)
    .map((d) => ({
      id: String(d._id),
      lat: d.coordinates!.lat,
      lng: d.coordinates!.lng,
    }));

  const optimized = await optimizeRoute(origin, stops);

  for (let i = 0; i < optimized.stops.length; i++) {
    await Delivery.updateOne(
      { _id: optimized.stops[i].id },
      { routeOrder: i + 1, updatedBy: req.user!._id }
    );
  }

  const schedDate = new Date(scheduledDate);
  schedDate.setHours(0, 0, 0, 0);

  const journey = await RiderJourney.create({
    companyId: rider.companyId,
    branchId: rider.branchId,
    riderId: rider._id,
    scheduledDate: schedDate,
    status: "active",
    optimizedRoute: optimized.stops.map((s, i) => ({
      deliveryId: s.id,
      order: i + 1,
      lat: s.lat,
      lng: s.lng,
    })),
    totalDistanceMeters: optimized.totalDistanceMeters,
    totalDurationSeconds: optimized.totalDurationSeconds,
    createdBy: req.user!._id,
  });

  await Delivery.updateMany(
    { _id: { $in: deliveryIds } },
    { journeyId: journey._id }
  );

  return sendSuccess(res, {
    journey,
    optimizedRoute: optimized,
    warehouse: origin,
  });
}

export async function sendDeliveryWhatsApp(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const delivery = await Delivery.findOne({ _id: req.params.id, ...tenant, deletedAt: null })
    .populate("customerId", "name phone")
    .populate("saleId", "saleNumber quantity totalAmount")
    .populate("riderId")
    .lean();

  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found", 404);

  const rider = delivery.riderId as { whatsappPhone?: string } | null;
  const phone = rider?.whatsappPhone;
  if (!phone) throw new AppError("BAD_REQUEST", "Rider has no WhatsApp phone on file", 400);

  const customer = delivery.customerId as { name?: string; phone?: string } | null;
  const sale = delivery.saleId as { saleNumber?: string; quantity?: number; totalAmount?: number } | null;

  const message = [
    `*Delivery Assignment*`,
    `Order: ${sale?.saleNumber ?? "—"}`,
    `Customer: ${customer?.name ?? customer?.phone ?? "—"}`,
    `Qty: ${sale?.quantity ?? "—"} | Total: ${sale?.totalAmount?.toFixed(3) ?? "—"} OMR`,
    `Address: ${delivery.deliveryAddress ?? "—"}`,
    delivery.timeSlotStart
      ? `Slot: ${new Date(delivery.timeSlotStart).toLocaleString()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const link = buildWhatsAppOrderLink(phone, message);
  await Delivery.updateOne({ _id: delivery._id }, { whatsappSentAt: new Date() });

  return sendSuccess(res, { whatsappLink: link, message });
}

export async function getDispatchDashboard(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const { start, end } = parseDeliveryDateRange(req.query as Record<string, unknown>);
  const dateFilter = deliveryInDateRangeQuery(start, end);

  const filter: Record<string, unknown> = { ...tenant, deletedAt: null, ...dateFilter };

  if (req.query.branchId) {
    const mainId = String(req.query.branchId);
    const branchIds = await expandMainBranchIds(mainId);
    filter.branchId = branchIdFilter(mainId, branchIds);
  }

  const [pending, scheduled, inTransit, delivered, activeRiderIds, recentPending] = await Promise.all([
    Delivery.countDocuments({ ...filter, status: "pending_assignment" }),
    Delivery.countDocuments({ ...filter, status: "scheduled" }),
    Delivery.countDocuments({ ...filter, status: "in_transit" }),
    Delivery.countDocuments({ ...filter, status: "delivered" }),
    Delivery.distinct("riderId", {
      ...filter,
      riderId: { $exists: true, $ne: null },
      status: { $in: ["scheduled", "in_transit", "delivered"] },
    }),
    Delivery.find({ ...filter, status: "pending_assignment" })
      .populate("customerId", "name phone area address coordinates")
      .populate("saleId", "saleNumber totalAmount quantity")
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  return sendSuccess(res, {
    dateFrom: formatLocalDate(start),
    dateTo: formatLocalDate(end),
    stats: { pending, scheduled, inTransit, delivered, activeRiders: activeRiderIds.length },
    recentPending,
  });
}

export async function updateWarehouseStatus(req: Request, res: Response) {
  const { status } = req.body as { status: string };
  const delivery = await advanceWarehouseStatus(
    String(req.params.id),
    status as import("../services/dispatch-engine.service").WarehouseStatus,
    String(req.user!._id)
  );
  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found", 404);
  return sendSuccess(res, delivery);
}

export async function startShift(req: Request, res: Response) {
  const rider = await getAuthenticatedRider(req);
  rider.isOnShift = true;
  rider.shiftStartedAt = new Date();
  rider.status = "available";
  rider.dailyDeliveriesCompleted = 0;
  rider.dailyKmTravelled = 0;
  await rider.save();
  return sendSuccess(res, { rider });
}

export async function endShift(req: Request, res: Response) {
  const rider = await getAuthenticatedRider(req);
  rider.isOnShift = false;
  rider.isOnJourney = false;
  rider.status = "offline";
  rider.shiftStartedAt = undefined;
  rider.set("currentLocation", undefined);
  await rider.save();

  await RiderJourney.updateMany(
    { riderId: rider._id, status: "active" },
    { status: "completed", endedAt: new Date() }
  );

  return sendSuccess(res, { rider });
}

/** Rider departs warehouse — route assignment becomes fixed */
export async function startRoute(req: Request, res: Response) {
  const rider = await getAuthenticatedRider(req);
  if (!rider.isOnShift) throw new AppError("BAD_REQUEST", "Start your shift first", 400);

  rider.isOnJourney = true;
  rider.status = "on_delivery";
  await rider.save();

  const deliveries = await Delivery.find({
    riderId: rider._id,
    deletedAt: null,
    warehouseStatus: "loaded",
    assignmentLocked: false,
  });

  for (const d of deliveries) {
    d.assignmentLocked = true;
    d.warehouseStatus = "dispatched";
    d.status = "in_transit";
    d.currentDestinationLocked = false;
    await d.save();
  }

  const firstStop = await Delivery.findOne({
    riderId: rider._id,
    status: "in_transit",
    deletedAt: null,
  }).sort({ routeOrder: 1 });

  if (firstStop) {
    firstStop.currentDestinationLocked = true;
    await firstStop.save();
  }

  return sendSuccess(res, { rider, firstStop });
}

export async function returnToWarehouse(req: Request, res: Response) {
  const rider = await getAuthenticatedRider(req);
  rider.status = "returning_to_warehouse";
  rider.isOnJourney = false;
  rider.predictedReturnAt = new Date(Date.now() + 20 * 60000);
  await rider.save();
  return sendSuccess(res, { rider });
}

export async function startJourney(req: Request, res: Response) {
  return startRoute(req, res);
}

export async function endJourney(req: Request, res: Response) {
  return returnToWarehouse(req, res);
}

export async function getMyDeliveries(req: Request, res: Response) {
  const rider = await getAuthenticatedRider(req);
  await rider.populate("branchId", "name gpsCoordinates");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const deliveries = await Delivery.find({
    riderId: rider._id,
    deletedAt: null,
    status: { $in: ["scheduled", "in_transit", "rescheduled"] },
    $or: [
      { scheduledDate: { $gte: today, $lt: tomorrow } },
      { scheduledDate: null },
    ],
  })
    .populate("customerId", "name phone address area coordinates")
    .populate("saleId", "saleNumber quantity totalAmount")
    .populate({ path: "saleId", populate: { path: "productId", select: "name sku" } })
    .sort({ routeOrder: 1, timeSlotStart: 1 })
    .lean();

  const journey = await RiderJourney.findOne({
    riderId: rider._id,
    status: "active",
    scheduledDate: { $gte: today, $lt: tomorrow },
  }).lean();

  const branch = rider.branchId as { name?: string; gpsCoordinates?: { lat: number; lng: number } } | null;
  const warehouse = await getBranchWarehousePoint(rider.branchId);
  const warehousePoint = {
    ...warehouse,
    label: branch?.name ?? "Warehouse",
  };

  const route = await buildRiderRoutePlan(warehousePoint, deliveries);

  return sendSuccess(res, { rider, deliveries, journey, route });
}
