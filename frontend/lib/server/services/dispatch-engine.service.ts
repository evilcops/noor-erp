import mongoose from "mongoose";
import { Delivery } from "../models/Delivery.model";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import { DeliveryRun } from "../models/DeliveryRun.model";
import { Rider } from "../models/Rider.model";
import { Branch } from "../models/Branch.model";
import { haversineDistanceMeters } from "./geocoding.service";
import { computePriorityScore } from "./delivery-scheduling.service";
import { pointInCluster } from "./cluster-grid.service";
import { optimizeRoute } from "./route-optimization.service";

/** Default warehouse prep time before dispatch (minutes) */
export const DEFAULT_PREP_MINUTES = 15;
export const PROMISE_WINDOW_MINUTES = 45;
export const AVG_DELIVERY_STOP_MINUTES = 12;
export const AVG_SPEED_MPS = 8;
/** Orders above this value may get a dedicated cluster run */
export const HIGH_VALUE_THRESHOLD = 40_000;
/** Low-value orders are always grouped into the next cluster run */
export const LOW_VALUE_THRESHOLD = 1_500;

type DeliveryLean = {
  _id: mongoose.Types.ObjectId;
  clusterId?: mongoose.Types.ObjectId;
  saleId?: { totalAmount?: number } | mongoose.Types.ObjectId;
  promisedWindowStart?: Date;
  priorityScore?: number;
  coordinates?: { lat: number; lng: number };
  assignmentLocked?: boolean;
  riderId?: mongoose.Types.ObjectId;
};

function deliveryValue(d: DeliveryLean): number {
  const sale = d.saleId;
  if (sale && typeof sale === "object" && "totalAmount" in sale) {
    return sale.totalAmount ?? 0;
  }
  return 0;
}

async function countClusterPendingDemand(companyId: string, branchId: string, clusterId?: string) {
  if (!clusterId) return 0;
  return Delivery.countDocuments({
    companyId,
    branchId,
    clusterId,
    deletedAt: null,
    status: { $nin: ["delivered", "cancelled"] },
    warehouseStatus: { $nin: ["dispatched"] },
  });
}

function buildAlternativeWindows(baseStart: Date, count = 3): { start: Date; end: Date }[] {
  const windows: { start: Date; end: Date }[] = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(baseStart.getTime() + i * PROMISE_WINDOW_MINUTES * 60000);
    windows.push({
      start,
      end: new Date(start.getTime() + PROMISE_WINDOW_MINUTES * 60000),
    });
  }
  return windows;
}

async function pickBestRiderForCluster(input: {
  companyId: string;
  branchId: string;
  clusterId?: string;
  deliveries: DeliveryLean[];
  excludeRiderIds: Set<string>;
  warehouseReadyAt: Date;
}) {
  const riders = await Rider.find({
    companyId: input.companyId,
    branchId: input.branchId,
    deletedAt: null,
    status: { $nin: ["offline", "inactive", "off_duty", "break"] },
  }).lean();

  const totalValue = input.deliveries.reduce((s, d) => s + deliveryValue(d), 0);
  const isHighValue = totalValue >= HIGH_VALUE_THRESHOLD && input.deliveries.length === 1;

  let best: (typeof riders)[0] | null = null;
  let bestScore = -Infinity;

  for (const rider of riders) {
    if (input.excludeRiderIds.has(String(rider._id))) continue;

    const load = await countActiveDeliveries(rider._id);
    const capacity = rider.vehicleCapacityUnits ?? 20;
    if (load + input.deliveries.length > capacity) continue;

    const availableAt = await predictRiderReturnTime(rider);
    const delayMin = Math.max(0, (availableAt.getTime() - input.warehouseReadyAt.getTime()) / 60000);

    let score = 100 - delayMin * 2 - load * 4;

    if (input.clusterId) {
      const sameCluster = await Delivery.countDocuments({
        riderId: rider._id,
        clusterId: input.clusterId,
        deletedAt: null,
        status: { $in: ["scheduled", "in_transit"] },
      });
      score += sameCluster * 15;
    }

    if (isHighValue && load === 0) score += 25;

    if (score > bestScore) {
      bestScore = score;
      best = rider;
    }
  }

  return best;
}

export type OrderSource =
  | "new_order"
  | "back_order"
  | "standing_daily"
  | "standing_weekly"
  | "standing_fortnightly"
  | "scheduled"
  | "previous_day"
  | "replenishment";

export type WarehouseStatus =
  | "order_confirmed"
  | "picking"
  | "packing"
  | "ready_for_dispatch"
  | "waiting_for_rider"
  | "loaded"
  | "dispatched";

export interface DeliveryPromisePrediction {
  promisedWindowStart: Date;
  promisedWindowEnd: Date;
  preparationMinutes: number;
  estimatedRiderAvailableAt: Date;
  clusterId?: string;
  provisionalRiderId?: string;
  alternativeWindows: { start: Date; end: Date }[];
}

export async function resolveClusterForPoint(
  companyId: string,
  branchId: string,
  coordinates?: { lat: number; lng: number }
) {
  if (!coordinates?.lat) return null;

  const clusters = await DeliveryCluster.find({
    companyId,
    branchId,
    status: "active",
    deletedAt: null,
  }).lean();

  let best: (typeof clusters)[0] | null = null;
  let bestDist = Infinity;

  for (const c of clusters) {
    if (pointInCluster(coordinates, {
      center: c.center,
      origin: c.origin ?? undefined,
      shape: c.shape,
      cellSizeKm: c.cellSizeKm,
      radiusKm: c.radiusKm,
      sectorStartDeg: c.sectorStartDeg,
      sectorEndDeg: c.sectorEndDeg,
    })) {
      const distM = haversineDistanceMeters(coordinates, c.center);
      if (distM < bestDist) {
        best = c;
        bestDist = distM;
      }
    }
  }

  return best;
}

async function countActiveDeliveries(riderId: mongoose.Types.ObjectId) {
  return Delivery.countDocuments({
    riderId,
    deletedAt: null,
    status: { $in: ["scheduled", "in_transit"] },
  });
}

async function predictRiderReturnTime(rider: {
  _id: mongoose.Types.ObjectId;
  predictedReturnAt?: Date;
  status?: string;
  currentRunId?: mongoose.Types.ObjectId;
}) {
  if (rider.predictedReturnAt && rider.predictedReturnAt > new Date()) {
    return rider.predictedReturnAt;
  }
  if (rider.status === "on_delivery" || rider.status === "loading") {
    const active = await Delivery.countDocuments({
      riderId: rider._id,
      status: "in_transit",
      deletedAt: null,
    });
    const remaining = await Delivery.countDocuments({
      riderId: rider._id,
      status: "scheduled",
      deletedAt: null,
    });
    const etaMs = (active > 0 ? AVG_DELIVERY_STOP_MINUTES : 0) * 60000;
    const remainingMs = remaining * AVG_DELIVERY_STOP_MINUTES * 60000;
    return new Date(Date.now() + etaMs + remainingMs + 20 * 60000);
  }
  return new Date();
}

/** Predict earliest achievable 45-minute delivery window before order confirmation */
export async function predictDeliveryPromise(input: {
  companyId: string;
  branchId: string;
  coordinates?: { lat: number; lng: number };
  totalAmount: number;
  quantity: number;
  preparationMinutes?: number;
  earliestAcceptableAt?: Date;
  orderSource?: OrderSource;
}): Promise<DeliveryPromisePrediction> {
  const prepMin = input.preparationMinutes ?? DEFAULT_PREP_MINUTES;
  const now = new Date();
  const warehouseReadyAt = new Date(now.getTime() + prepMin * 60000);

  const cluster = await resolveClusterForPoint(
    input.companyId,
    input.branchId,
    input.coordinates
  );

  const clusterDemand = cluster?._id
    ? await countClusterPendingDemand(
        input.companyId,
        input.branchId,
        String(cluster._id)
      )
    : 0;

  const riders = await Rider.find({
    companyId: input.companyId,
    branchId: input.branchId,
    deletedAt: null,
    status: { $in: ["available", "active", "on_delivery", "returning_to_warehouse", "loading"] },
  }).lean();

  let bestRider: (typeof riders)[0] | null = null;
  let earliestRiderAt = new Date(now.getTime() + 2 * 60 * 60000);

  for (const rider of riders) {
    const load = await countActiveDeliveries(rider._id);
    const capacity = rider.vehicleCapacityUnits ?? 20;
    if (load >= capacity) continue;

    const availableAt = await predictRiderReturnTime(rider);
    const riderReady = availableAt > warehouseReadyAt ? availableAt : warehouseReadyAt;

    if (riderReady < earliestRiderAt) {
      earliestRiderAt = riderReady;
      bestRider = rider;
    }
  }

  if (!bestRider) {
    earliestRiderAt = new Date(warehouseReadyAt.getTime() + 60 * 60000);
  }

  let promisedWindowStart = new Date(
    Math.max(
      warehouseReadyAt.getTime(),
      earliestRiderAt.getTime(),
      input.earliestAcceptableAt?.getTime() ?? 0
    )
  );

  const isLowValue = input.totalAmount < LOW_VALUE_THRESHOLD;
  if (isLowValue && clusterDemand > 0) {
    const bundleBonus = Math.min(clusterDemand * 3, 15) * 60000;
    promisedWindowStart = new Date(promisedWindowStart.getTime() - bundleBonus);
    if (promisedWindowStart < warehouseReadyAt) promisedWindowStart = warehouseReadyAt;
  }

  const promisedWindowEnd = new Date(
    promisedWindowStart.getTime() + PROMISE_WINDOW_MINUTES * 60000
  );

  const altBase = input.earliestAcceptableAt
    ? new Date(Math.max(promisedWindowStart.getTime(), input.earliestAcceptableAt.getTime()))
    : new Date(promisedWindowStart.getTime() + PROMISE_WINDOW_MINUTES * 60000);

  const alternatives = buildAlternativeWindows(altBase, 3);

  return {
    promisedWindowStart,
    promisedWindowEnd,
    preparationMinutes: prepMin,
    estimatedRiderAvailableAt: earliestRiderAt,
    clusterId: cluster?._id ? String(cluster._id) : undefined,
    provisionalRiderId: bestRider?._id ? String(bestRider._id) : undefined,
    alternativeWindows: alternatives,
  };
}

/** Add order to warehouse demand queue (all due orders share one queue) */
export async function getDemandQueue(companyId: string, branchId: string) {
  return Delivery.find({
    companyId,
    branchId,
    deletedAt: null,
    warehouseStatus: {
      $in: [
        "order_confirmed",
        "picking",
        "packing",
        "ready_for_dispatch",
        "waiting_for_rider",
      ],
    },
    status: { $nin: ["delivered", "cancelled"] },
  })
    .sort({ priorityScore: -1, promisedWindowStart: 1, createdAt: 1 })
    .populate("customerId", "name phone area")
    .populate("saleId", "saleNumber totalAmount quantity")
    .populate("clusterId", "code name")
    .populate("riderId", "riderCode")
    .lean();
}

/** Provisional rider assignment before rider returns — cluster-aware, bundles low-value orders */
export async function provisionalAssignRider(deliveryId: string) {
  const delivery = await Delivery.findById(deliveryId).populate("saleId", "totalAmount").lean();
  if (!delivery || delivery.assignmentLocked) {
    return Delivery.findById(deliveryId);
  }

  const lean = delivery as DeliveryLean & {
    companyId: mongoose.Types.ObjectId;
    branchId: mongoose.Types.ObjectId;
    clusterId?: mongoose.Types.ObjectId;
  };

  const value = deliveryValue(lean);
  if (value < LOW_VALUE_THRESHOLD && lean.clusterId) {
    const existingRun = await Delivery.findOne({
      companyId: lean.companyId,
      branchId: lean.branchId,
      clusterId: lean.clusterId,
      deletedAt: null,
      status: { $in: ["scheduled", "in_transit"] },
      riderId: { $exists: true },
      _id: { $ne: lean._id },
    }).lean();

    if (existingRun?.riderId) {
      await Delivery.updateOne(
        { _id: deliveryId },
        {
          riderId: existingRun.riderId,
          provisionalRiderId: existingRun.riderId,
          status: "scheduled",
        }
      );
      return Delivery.findById(deliveryId);
    }
  }

  const warehouseReadyAt =
    lean.promisedWindowStart ??
    new Date(Date.now() + DEFAULT_PREP_MINUTES * 60000);

  const rider = await pickBestRiderForCluster({
    companyId: String(lean.companyId),
    branchId: String(lean.branchId),
    clusterId: lean.clusterId ? String(lean.clusterId) : undefined,
    deliveries: [lean],
    excludeRiderIds: new Set(),
    warehouseReadyAt,
  });

  if (rider) {
    await Delivery.updateOne(
      { _id: deliveryId },
      {
        riderId: rider._id,
        provisionalRiderId: rider._id,
        status: "scheduled",
      }
    );
  }

  return Delivery.findById(deliveryId);
}

/** Final optimisation before loading — may reassign if better rider found */
export async function finaliseAssignmentBeforeLoading(deliveryId: string) {
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery || delivery.assignmentLocked) return delivery;

  await provisionalAssignRider(deliveryId);
  return Delivery.findById(deliveryId);
}

/** Lock assignment once rider loads and departs */
export async function lockDeliveryAssignment(deliveryId: string) {
  await Delivery.updateOne(
    { _id: deliveryId },
    {
      assignmentLocked: true,
      warehouseStatus: "dispatched",
      status: "in_transit",
    }
  );
}

/** Protect current destination — never reorder locked stops */
export function protectCurrentDestination(
  stops: { deliveryId: string; isLocked?: boolean; isCurrentDestination?: boolean }[]
) {
  const currentIdx = stops.findIndex((s) => s.isCurrentDestination || s.isLocked);
  if (currentIdx < 0) return stops;
  return stops.map((s, i) => ({
    ...s,
    isLocked: i <= currentIdx ? true : s.isLocked,
  }));
}

/** Cluster-first fleet plan — one rider per cluster run where possible */
export async function optimiseFleetPlan(input: {
  companyId: string;
  branchId: string;
  trigger: string;
}) {
  const branch = await Branch.findById(input.branchId).lean();
  const origin = branch?.gpsCoordinates ?? { lat: 23.588, lng: 58.3829 };
  const now = new Date();
  const warehouseReadyAt = new Date(now.getTime() + DEFAULT_PREP_MINUTES * 60000);

  const assignable = await Delivery.find({
    companyId: input.companyId,
    branchId: input.branchId,
    deletedAt: null,
    assignmentLocked: false,
    currentDestinationLocked: false,
    status: { $in: ["pending_assignment", "scheduled"] },
    warehouseStatus: { $nin: ["dispatched"] },
  })
    .populate("saleId", "totalAmount")
    .lean();

  const byCluster = new Map<string, DeliveryLean[]>();
  for (const d of assignable) {
    const key = d.clusterId ? String(d.clusterId) : "unclustered";
    const list = byCluster.get(key) ?? [];
    list.push(d as DeliveryLean);
    byCluster.set(key, list);
  }

  const clusterEntries = [...byCluster.entries()].sort((a, b) => {
    const valueA = a[1].reduce((s, d) => s + deliveryValue(d), 0);
    const valueB = b[1].reduce((s, d) => s + deliveryValue(d), 0);
    if (valueB !== valueA) return valueB - valueA;
    return b[1].length - a[1].length;
  });

  const usedRiders = new Set<string>();
  const results: {
    riderId: string;
    runId: string;
    clusterId: string;
    stops: number;
    totalValue: number;
  }[] = [];

  for (const [clusterKey, clusterDeliveries] of clusterEntries) {
    const totalValue = clusterDeliveries.reduce((s, d) => s + deliveryValue(d), 0);
    const clusterId = clusterKey === "unclustered" ? undefined : clusterKey;

    const lowValueOnly =
      clusterDeliveries.every((d) => deliveryValue(d) < LOW_VALUE_THRESHOLD) &&
      clusterDeliveries.length === 1;

    if (lowValueOnly && clusterId) {
      const existingRun = await Delivery.findOne({
        companyId: input.companyId,
        branchId: input.branchId,
        clusterId,
        deletedAt: null,
        status: { $in: ["scheduled", "in_transit"] },
        riderId: { $exists: true },
      }).lean();

      if (existingRun?.riderId) {
        const riderId = String(existingRun.riderId);
        for (const d of clusterDeliveries) {
          await Delivery.updateOne(
            { _id: d._id },
            { riderId, provisionalRiderId: riderId, status: "scheduled" }
          );
        }
        usedRiders.add(riderId);
        continue;
      }
    }

    const rider = await pickBestRiderForCluster({
      companyId: input.companyId,
      branchId: input.branchId,
      clusterId,
      deliveries: clusterDeliveries,
      excludeRiderIds: usedRiders,
      warehouseReadyAt,
    });

    if (!rider) continue;

    const riderId = rider._id;
    usedRiders.add(String(riderId));

    for (const d of clusterDeliveries) {
      await Delivery.updateOne(
        { _id: d._id },
        { riderId, provisionalRiderId: riderId, status: "scheduled" }
      );
    }

    const withCoords = clusterDeliveries.filter((d) => d.coordinates?.lat);
    if (!withCoords.length) {
      results.push({
        riderId: String(riderId),
        runId: "",
        clusterId: clusterKey,
        stops: clusterDeliveries.length,
        totalValue,
      });
      continue;
    }

    const stops = withCoords.map((d) => ({
      id: String(d._id),
      lat: d.coordinates!.lat,
      lng: d.coordinates!.lng,
    }));

    const optimized = await optimizeRoute(origin, stops);
    const kpis = computeDeliveryKpis(
      clusterDeliveries.map((d) => ({ totalAmount: deliveryValue(d) })),
      optimized.totalDistanceMeters
    );

    const returnEta = new Date(
      now.getTime() +
        optimized.totalDurationSeconds * 1000 +
        clusterDeliveries.length * AVG_DELIVERY_STOP_MINUTES * 60000 +
        20 * 60000
    );

    const runNumber = `RUN-${new Date().getFullYear()}-${clusterKey.slice(-4)}-${Date.now()}`;
    const run = await DeliveryRun.create({
      companyId: input.companyId,
      branchId: input.branchId,
      riderId,
      runNumber,
      status: "planning",
      scheduledDate: now,
      clusterIds: clusterId ? [clusterId] : [],
      stops: optimized.stops.map((s, i) => ({
        deliveryId: s.id,
        order: i + 1,
        lat: s.lat,
        lng: s.lng,
      })),
      totalDistanceMeters: optimized.totalDistanceMeters,
      totalDurationSeconds: optimized.totalDurationSeconds,
      deliveriesPerKm: kpis.deliveriesPerKm,
      grossMarginPerKm: kpis.grossMarginPerKm,
      vehicleCapacityUsed: clusterDeliveries.length,
    });

    for (let i = 0; i < optimized.stops.length; i++) {
      await Delivery.updateOne(
        { _id: optimized.stops[i].id },
        { routeOrder: i + 1, runId: run._id, status: "scheduled" }
      );
    }

    await Rider.updateOne(
      { _id: riderId },
      { currentRunId: run._id, predictedReturnAt: returnEta }
    );

    results.push({
      riderId: String(riderId),
      runId: String(run._id),
      clusterId: clusterKey,
      stops: optimized.stops.length,
      totalValue,
    });
  }

  return { trigger: input.trigger, optimised: results };
}

export async function advanceWarehouseStatus(
  deliveryId: string,
  status: WarehouseStatus,
  userId?: string
) {
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) return null;

  delivery.warehouseStatus = status;
  if (userId) delivery.updatedBy = new mongoose.Types.ObjectId(userId);

  if (status === "ready_for_dispatch") {
    await provisionalAssignRider(deliveryId);
    delivery.status = "scheduled";
  }

  if (status === "loaded") {
    await finaliseAssignmentBeforeLoading(deliveryId);
  }

  await delivery.save();

  if (status !== "dispatched") {
    void optimiseFleetPlan({
      companyId: String(delivery.companyId),
      branchId: String(delivery.branchId),
      trigger: `warehouse_${status}`,
    });
  }

  if (status === "dispatched") {
    await lockDeliveryAssignment(deliveryId);
    void optimiseFleetPlan({
      companyId: String(delivery.companyId),
      branchId: String(delivery.branchId),
      trigger: "dispatch_departed",
    });
  }

  return delivery;
}

export function computeDeliveryKpis(deliveries: { totalAmount?: number }[], distanceMeters: number) {
  const km = distanceMeters / 1000 || 1;
  const grossMargin = deliveries.reduce((s, d) => s + (d.totalAmount ?? 0) * 0.3, 0);
  return {
    deliveriesPerKm: deliveries.length / km,
    grossMarginPerKm: grossMargin / km,
    costPerDelivery: (km * 0.15) / Math.max(deliveries.length, 1),
  };
}

/** Customer cannot receive proposed window — offer alternatives from predicted capacity */
export async function offerRescheduleWindows(deliveryId: string, earliestAcceptableAt?: Date) {
  const delivery = await Delivery.findById(deliveryId).populate("saleId", "totalAmount quantity");
  if (!delivery) return null;

  const sale = delivery.saleId as { totalAmount?: number; quantity?: number } | null;
  const prediction = await predictDeliveryPromise({
    companyId: String(delivery.companyId),
    branchId: String(delivery.branchId),
    coordinates: delivery.coordinates,
    totalAmount: sale?.totalAmount ?? 0,
    quantity: sale?.quantity ?? 1,
    earliestAcceptableAt,
    orderSource: delivery.orderSource,
  });

  return {
    deliveryId,
    promisedWindowStart: prediction.promisedWindowStart,
    promisedWindowEnd: prediction.promisedWindowEnd,
    alternativeWindows: prediction.alternativeWindows,
  };
}

/** Apply customer-selected delivery promise */
export async function confirmDeliveryPromise(
  deliveryId: string,
  window: { start: Date; end: Date }
) {
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) return null;

  delivery.promisedWindowStart = window.start;
  delivery.promisedWindowEnd = window.end;
  delivery.timeSlotStart = window.start;
  delivery.timeSlotEnd = window.end;
  delivery.scheduledDate = window.start;
  delivery.promiseAcceptedAt = new Date();
  delivery.status = "pending_assignment";
  await delivery.save();

  await provisionalAssignRider(deliveryId);
  void optimiseFleetPlan({
    companyId: String(delivery.companyId),
    branchId: String(delivery.branchId),
    trigger: "promise_confirmed",
  });

  return delivery;
}

/** Rider reports breakdown — reassign unlocked remaining deliveries */
export async function handleRiderBreakdown(riderId: string) {
  const rider = await Rider.findById(riderId);
  if (!rider) return { reassigned: 0 };

  rider.status = "offline";
  rider.isOnJourney = false;
  await rider.save();

  const remaining = await Delivery.find({
    riderId: rider._id,
    deletedAt: null,
    assignmentLocked: false,
    status: { $in: ["scheduled", "pending_assignment"] },
  });

  for (const d of remaining) {
    d.riderId = undefined;
    d.provisionalRiderId = undefined;
    d.runId = undefined;
    d.routeOrder = undefined;
    d.status = "pending_assignment";
    await d.save();
  }

  const result = await optimiseFleetPlan({
    companyId: String(rider.companyId),
    branchId: String(rider.branchId),
    trigger: "rider_breakdown",
  });

  return { reassigned: remaining.length, optimisation: result };
}

/** Customer unavailable — reschedule with new windows */
export async function handleCustomerUnavailable(deliveryId: string) {
  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) return null;

  delivery.status = "rescheduled";
  delivery.failureReason = "customer_unavailable";
  await delivery.save();

  const windows = await offerRescheduleWindows(deliveryId);

  void optimiseFleetPlan({
    companyId: String(delivery.companyId),
    branchId: String(delivery.branchId),
    trigger: "customer_unavailable",
  });

  return windows;
}

/** Fleet snapshot for dispatch dashboard */
export async function getFleetDispatchSnapshot(companyId: string, branchId: string) {
  const queue = await getDemandQueue(companyId, branchId);

  const bySource: Record<string, number> = {};
  const clusterMap = new Map<string, { clusterId: string; code: string; count: number; totalValue: number }>();

  for (const d of queue) {
    const src = d.orderSource ?? "new_order";
    bySource[src] = (bySource[src] ?? 0) + 1;

    const cluster = d.clusterId as { _id?: string; code?: string } | string | undefined;
    const clusterId = typeof cluster === "object" && cluster?._id ? String(cluster._id) : String(cluster ?? "none");
    const code = typeof cluster === "object" && cluster?.code ? cluster.code : "—";
    const sale = d.saleId as { totalAmount?: number } | undefined;
    const value = sale?.totalAmount ?? 0;

    const entry = clusterMap.get(clusterId) ?? { clusterId, code, count: 0, totalValue: 0 };
    entry.count += 1;
    entry.totalValue += value;
    clusterMap.set(clusterId, entry);
  }

  const riders = await Rider.find({
    companyId,
    branchId,
    deletedAt: null,
    status: { $nin: ["inactive", "off_duty"] },
  }).lean();

  const riderSnapshots = await Promise.all(
    riders.map(async (r) => {
      const stops = await Delivery.countDocuments({
        riderId: r._id,
        deletedAt: null,
        status: { $in: ["scheduled", "in_transit"] },
      });
      return {
        riderId: String(r._id),
        riderCode: r.riderCode,
        status: r.status,
        predictedReturnAt: r.predictedReturnAt,
        activeStops: stops,
      };
    })
  );

  const activeRuns = await DeliveryRun.find({
    companyId,
    branchId,
    status: { $in: ["planning", "loading", "active"] },
  })
    .populate("riderId", "riderCode")
    .lean();

  return {
    demandQueueTotal: queue.length,
    bySource,
    byCluster: [...clusterMap.values()],
    riders: riderSnapshots,
    activeRuns: activeRuns.map((run) => ({
      runId: String(run._id),
      runNumber: run.runNumber,
      riderCode:
        typeof run.riderId === "object" && run.riderId && "riderCode" in run.riderId
          ? (run.riderId as { riderCode: string }).riderCode
          : "—",
      clusterIds: (run.clusterIds ?? []).map(String),
      stops: run.stops?.length ?? 0,
      deliveriesPerKm: run.deliveriesPerKm,
      grossMarginPerKm: run.grossMarginPerKm,
    })),
  };
}
