import mongoose from "mongoose";
import { Delivery } from "../models/Delivery.model";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import { DeliveryRun } from "../models/DeliveryRun.model";
import { Rider } from "../models/Rider.model";
import { Branch } from "../models/Branch.model";
import { DISPATCH_CONFIG } from "../config/dispatch.config";
import { haversineDistanceMeters } from "./geocoding.service";
import { pointInCluster } from "./cluster-grid.service";
import { optimizeRoute } from "./route-optimization.service";
import { deliveryInDateRangeQuery, scheduledDateInRangeQuery } from "../utils/deliveryDateFilter";
import { branchIdFilter, expandMainBranchIds, getBranchWarehousePoint } from "../utils/branchScope";
import {
  refreshQueuePriorities,
  compareDeliveriesByDispatchPriority,
} from "./dispatch-priority.service";
import {
  estimateTravelMinutes,
  computeRouteStopEtas,
  computeWarehouseReadyAt,
  canRiderMeetPromises,
} from "./dispatch-timing.service";
import { autoAdvanceWarehousePrep } from "./dispatch-automation.service";

/** @deprecated use DISPATCH_CONFIG — kept for existing imports */
export const DEFAULT_PREP_MINUTES = DISPATCH_CONFIG.prepMinutes;
export const PROMISE_WINDOW_MINUTES = DISPATCH_CONFIG.promiseWindowMinutes;
export const AVG_DELIVERY_STOP_MINUTES = DISPATCH_CONFIG.avgStopServiceMinutes;
export const AVG_SPEED_MPS = DISPATCH_CONFIG.avgSpeedMps;
export const HIGH_VALUE_THRESHOLD = DISPATCH_CONFIG.highValueThreshold;
export const LOW_VALUE_THRESHOLD = DISPATCH_CONFIG.lowValueThreshold;
export const WAREHOUSE_NEAR_RADIUS_KM = DISPATCH_CONFIG.warehouseNearRadiusKm;
export const WAREHOUSE_PROXIMITY_BONUS_MAX = DISPATCH_CONFIG.warehouseProximityBonusMax;
export const LOAD_PENALTY_PER_STOP = DISPATCH_CONFIG.loadPenaltyPerStop;
export const MAX_STOPS_PER_OPTIMISE_PASS = DISPATCH_CONFIG.maxStopsPerOptimisePass;
const RIDER_LOCATION_MAX_AGE_MS = DISPATCH_CONFIG.riderLocationMaxAgeMs;

const pendingOptimise = new Map<string, ReturnType<typeof setTimeout>>();
let backgroundDispatchStarted = false;

function riderCapacity(rider: { vehicleCapacityUnits?: number }) {
  return rider.vehicleCapacityUnits ?? DISPATCH_CONFIG.defaultVehicleCapacity;
}

const EN_ROUTE_RIDER_STATUSES = ["on_delivery", "loading"] as const;
const UNAVAILABLE_RIDER_STATUSES = [
  "offline",
  "inactive",
  "off_duty",
  "break",
  ...EN_ROUTE_RIDER_STATUSES,
] as const;

type DeliveryLean = {
  _id: mongoose.Types.ObjectId;
  clusterId?: mongoose.Types.ObjectId;
  saleId?: { totalAmount?: number } | mongoose.Types.ObjectId;
  promisedWindowStart?: Date;
  promisedWindowEnd?: Date;
  priorityScore?: number;
  createdAt?: Date;
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

function warehouseProximityBonus(
  rider: {
    isOnShift?: boolean;
    currentLocation?: { lat?: number; lng?: number; updatedAt?: Date };
  },
  warehouse: { lat: number; lng: number }
): number {
  if (!rider.isOnShift) return 0;
  const loc = rider.currentLocation;
  if (loc?.lat == null || loc?.lng == null) return 0;

  if (loc.updatedAt) {
    const age = Date.now() - new Date(loc.updatedAt).getTime();
    if (age > RIDER_LOCATION_MAX_AGE_MS) return 0;
  }

  const distKm = haversineDistanceMeters(
    { lat: loc.lat, lng: loc.lng },
    warehouse
  ) / 1000;
  if (distKm > WAREHOUSE_NEAR_RADIUS_KM) return 0;

  return WAREHOUSE_PROXIMITY_BONUS_MAX * (1 - distKm / WAREHOUSE_NEAR_RADIUS_KM);
}

async function pickBestRiderForCluster(input: {
  companyId: string;
  branchId: string;
  clusterId?: string;
  deliveries: DeliveryLean[];
  excludeRiderIds: Set<string>;
  warehouseReadyAt: Date;
}) {
  const warehouse = await getBranchWarehousePoint(input.branchId);
  const riders = await Rider.find({
    companyId: input.companyId,
    branchId: input.branchId,
    deletedAt: null,
    isOnJourney: false,
    status: { $nin: UNAVAILABLE_RIDER_STATUSES },
  }).lean();

  const totalValue = input.deliveries.reduce((s, d) => s + deliveryValue(d), 0);
  const isHighValue = totalValue >= HIGH_VALUE_THRESHOLD && input.deliveries.length === 1;

  let best: (typeof riders)[0] | null = null;
  let bestScore = -Infinity;

  for (const rider of riders) {
    if (input.excludeRiderIds.has(String(rider._id))) continue;
    if (isRiderEnRoute(rider)) continue;
    if (!(await canRiderAcceptNewOrders(rider._id))) continue;

    const load = await countPendingRouteLoad(rider._id);
    const capacity = riderCapacity(rider);
    if (load + input.deliveries.length > capacity) continue;
    if (load >= MAX_STOPS_PER_OPTIMISE_PASS) continue;

    const availableAt = await predictRiderReturnTime(rider);
    if (
      !canRiderMeetPromises({
        riderAvailableAt: availableAt,
        warehouseReadyAt: input.warehouseReadyAt,
        origin: warehouse,
        deliveries: input.deliveries,
        existingLoad: load,
      })
    ) {
      continue;
    }

    const delayMin = Math.max(0, (availableAt.getTime() - input.warehouseReadyAt.getTime()) / 60000);

    let score = 100 - delayMin * 2 - load * LOAD_PENALTY_PER_STOP;
    if (rider.isOnShift) score += DISPATCH_CONFIG.onShiftBonus;

    if (input.clusterId) {
      const sameCluster = await Delivery.countDocuments({
        riderId: rider._id,
        clusterId: input.clusterId,
        deletedAt: null,
        status: "scheduled",
        warehouseStatus: { $nin: ["dispatched"] },
        assignmentLocked: false,
      });
      score += sameCluster * DISPATCH_CONFIG.sameClusterBonus;
    }

    if (isHighValue && load === 0) score += DISPATCH_CONFIG.highValueEmptyRiderBonus;

    score += warehouseProximityBonus(rider, warehouse);

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
  warehouseReadyAt: Date;
  travelTimeMinutes: number;
  estimatedDeliveryAt: Date;
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

/** Stops on the rider's next warehouse run (not yet dispatched). */
async function countPendingRouteLoad(riderId: mongoose.Types.ObjectId) {
  return Delivery.countDocuments({
    riderId,
    deletedAt: null,
    status: "scheduled",
    warehouseStatus: { $nin: ["dispatched"] },
    assignmentLocked: false,
  });
}

function isRiderEnRoute(rider: { isOnJourney?: boolean; status?: string }) {
  return Boolean(
    rider.isOnJourney || (rider.status && EN_ROUTE_RIDER_STATUSES.includes(rider.status as (typeof EN_ROUTE_RIDER_STATUSES)[number]))
  );
}

/** Riders en route must not receive new stops — orders wait in queue instead. */
export async function canRiderAcceptNewOrders(
  riderId: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const rider = await Rider.findById(riderId).select("isOnJourney status").lean();
  if (!rider || isRiderEnRoute(rider)) return false;

  const inTransit = await Delivery.countDocuments({
    riderId,
    deletedAt: null,
    status: "in_transit",
  });
  return inTransit === 0;
}

/** Bundle low-value orders onto a warehouse rider already serving this cluster. */
async function findClusterBundleRider(input: {
  companyId: string;
  branchId: string;
  clusterId: string;
  excludeDeliveryId?: string;
}): Promise<mongoose.Types.ObjectId | null> {
  const candidates = await Delivery.find({
    companyId: input.companyId,
    branchId: input.branchId,
    clusterId: input.clusterId,
    deletedAt: null,
    status: "scheduled",
    warehouseStatus: { $nin: ["dispatched"] },
    assignmentLocked: false,
    riderId: { $exists: true },
    ...(input.excludeDeliveryId ? { _id: { $ne: input.excludeDeliveryId } } : {}),
  })
    .select("riderId")
    .lean();

  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c.riderId) continue;
    const riderId = String(c.riderId);
    if (seen.has(riderId)) continue;
    seen.add(riderId);
    if (await canRiderAcceptNewOrders(c.riderId)) {
      return c.riderId as mongoose.Types.ObjectId;
    }
  }
  return null;
}

async function refreshDeliveryPromiseEstimates(
  companyId: string,
  branchId: string,
  deliveryIds?: string[]
) {
  const filter: Record<string, unknown> = {
    companyId,
    branchId,
    deletedAt: null,
    status: "pending_assignment",
    warehouseStatus: { $nin: ["dispatched"] },
  };
  if (deliveryIds?.length) filter._id = { $in: deliveryIds };

  const queued = await Delivery.find(filter).populate("saleId", "totalAmount quantity").lean();

  for (const d of queued) {
    const sale = d.saleId as { totalAmount?: number; quantity?: number } | null;
    const prediction = await predictDeliveryPromise({
      companyId,
      branchId,
      coordinates: d.coordinates,
      totalAmount: sale?.totalAmount ?? 0,
      quantity: sale?.quantity ?? 1,
      orderSource: d.orderSource,
    });

    await Delivery.updateOne(
      { _id: d._id },
      {
        promisedWindowStart: prediction.promisedWindowStart,
        promisedWindowEnd: prediction.promisedWindowEnd,
        timeSlotStart: prediction.promisedWindowStart,
        timeSlotEnd: prediction.promisedWindowEnd,
        scheduledDate: prediction.promisedWindowStart,
        provisionalRiderId: prediction.provisionalRiderId,
        preparationMinutes: prediction.preparationMinutes,
        warehouseReadyAt: prediction.warehouseReadyAt,
        travelTimeMinutes: prediction.travelTimeMinutes,
        estimatedArrival: prediction.estimatedDeliveryAt,
      }
    );
  }
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

/** Predict earliest achievable delivery window before order confirmation */
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
    isOnJourney: false,
    status: { $nin: UNAVAILABLE_RIDER_STATUSES },
  }).lean();

  const warehouse = await getBranchWarehousePoint(input.branchId);
  let bestRider: (typeof riders)[0] | null = null;
  let bestScore = -Infinity;
  let earliestRiderAt = new Date(now.getTime() + 2 * 60 * 60000);

  for (const rider of riders) {
    if (isRiderEnRoute(rider)) continue;
    if (!(await canRiderAcceptNewOrders(rider._id))) continue;

    const load = await countPendingRouteLoad(rider._id);
    const capacity = riderCapacity(rider);
    if (load >= capacity) continue;

    const availableAt = await predictRiderReturnTime(rider);
    const riderReady = availableAt > warehouseReadyAt ? availableAt : warehouseReadyAt;

    const delayMin = Math.max(0, (riderReady.getTime() - warehouseReadyAt.getTime()) / 60000);
    let score = 100 - delayMin * 2 - load * LOAD_PENALTY_PER_STOP + warehouseProximityBonus(rider, warehouse);
    if (rider.isOnShift) score += DISPATCH_CONFIG.onShiftBonus;

    if (score > bestScore) {
      bestScore = score;
      bestRider = rider;
      earliestRiderAt = riderReady;
    }
  }

  if (!bestRider) {
    const returning = await Rider.find({
      companyId: input.companyId,
      branchId: input.branchId,
      deletedAt: null,
      status: "returning_to_warehouse",
    })
      .sort({ predictedReturnAt: 1 })
      .lean();

    if (returning[0]?.predictedReturnAt) {
      earliestRiderAt = new Date(
        Math.max(returning[0].predictedReturnAt.getTime(), warehouseReadyAt.getTime())
      );
    } else {
      earliestRiderAt = new Date(warehouseReadyAt.getTime() + 60 * 60000);
    }
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

  const travelTimeMinutes = input.coordinates?.lat
    ? estimateTravelMinutes(warehouse, input.coordinates)
    : 0;

  if (travelTimeMinutes > 0) {
    promisedWindowStart = new Date(promisedWindowStart.getTime() + travelTimeMinutes * 60000);
  }

  const estimatedDeliveryAt = new Date(promisedWindowStart.getTime());

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
    warehouseReadyAt,
    travelTimeMinutes,
    estimatedDeliveryAt,
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
    const bundleRiderId = await findClusterBundleRider({
      companyId: String(lean.companyId),
      branchId: String(lean.branchId),
      clusterId: String(lean.clusterId),
      excludeDeliveryId: String(lean._id),
    });

    if (bundleRiderId) {
      await Delivery.updateOne(
        { _id: deliveryId },
        {
          riderId: bundleRiderId,
          provisionalRiderId: bundleRiderId,
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
  } else {
    await Delivery.updateOne(
      { _id: deliveryId },
      {
        status: "pending_assignment",
        riderId: undefined,
        provisionalRiderId: undefined,
      }
    );
    await refreshDeliveryPromiseEstimates(
      String(lean.companyId),
      String(lean.branchId),
      [String(lean._id)]
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

/** Build or extend a warehouse planning run — never touches en-route riders. */
async function assignDeliveriesToRiderRun(input: {
  companyId: string;
  branchId: string;
  riderId: mongoose.Types.ObjectId;
  deliveries: DeliveryLean[];
  origin: { lat: number; lng: number };
  now: Date;
  clusterId?: string;
}) {
  if (!(await canRiderAcceptNewOrders(input.riderId))) return null;

  for (const d of input.deliveries) {
    await Delivery.updateOne(
      { _id: d._id },
      {
        riderId: input.riderId,
        provisionalRiderId: input.riderId,
        status: "scheduled",
      }
    );
  }

  const allForRider = await Delivery.find({
    riderId: input.riderId,
    deletedAt: null,
    status: "scheduled",
    warehouseStatus: { $nin: ["dispatched"] },
    assignmentLocked: false,
  })
    .populate("saleId", "totalAmount")
    .lean();

  const merged = allForRider as DeliveryLean[];
  const withCoords = merged.filter((d) => d.coordinates?.lat);
  if (!withCoords.length) return null;

  const stops = withCoords.map((d) => ({
    id: String(d._id),
    lat: d.coordinates!.lat,
    lng: d.coordinates!.lng,
  }));

  const optimized = await optimizeRoute(input.origin, stops);
  const totalValue = merged.reduce((s, d) => s + deliveryValue(d), 0);
  const kpis = computeDeliveryKpis(
    merged.map((d) => ({ totalAmount: deliveryValue(d) })),
    optimized.totalDistanceMeters
  );

  const warehouseReadyAt = computeWarehouseReadyAt(input.now);
  const departAt = input.now > warehouseReadyAt ? input.now : warehouseReadyAt;
  const stopEtas = computeRouteStopEtas({
    origin: input.origin,
    stops: optimized.stops,
    departAt,
    totalDurationSeconds: optimized.totalDurationSeconds,
  });

  const returnEta = new Date(
    input.now.getTime() +
      optimized.totalDurationSeconds * 1000 +
      merged.length * AVG_DELIVERY_STOP_MINUTES * 60000 +
      20 * 60000
  );

  const existingRun = await DeliveryRun.findOne({
    riderId: input.riderId,
    status: { $in: ["planning", "loading"] },
    assignmentLocked: false,
  }).sort({ createdAt: -1 });

  const clusterIds = new Set((existingRun?.clusterIds ?? []).map(String));
  if (input.clusterId) clusterIds.add(input.clusterId);

  let run = existingRun;
  if (run) {
    run.stops = optimized.stops.map((s, i) => ({
      deliveryId: new mongoose.Types.ObjectId(s.id),
      order: i + 1,
      lat: s.lat,
      lng: s.lng,
    }));
    run.clusterIds = [...clusterIds].map((id) => new mongoose.Types.ObjectId(id));
    run.totalDistanceMeters = optimized.totalDistanceMeters;
    run.totalDurationSeconds = optimized.totalDurationSeconds;
    run.deliveriesPerKm = kpis.deliveriesPerKm;
    run.grossMarginPerKm = kpis.grossMarginPerKm;
    run.vehicleCapacityUsed = merged.length;
    await run.save();
  } else {
    const clusterKey = input.clusterId ?? "mixed";
    const runNumber = `RUN-${new Date().getFullYear()}-${clusterKey.slice(-4)}-${Date.now()}`;
    run = await DeliveryRun.create({
      companyId: input.companyId,
      branchId: input.branchId,
      riderId: input.riderId,
      runNumber,
      status: "planning",
      scheduledDate: input.now,
      clusterIds: [...clusterIds].map((id) => new mongoose.Types.ObjectId(id)),
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
      vehicleCapacityUsed: merged.length,
    });
  }

  for (let i = 0; i < optimized.stops.length; i++) {
    const stopId = optimized.stops[i].id;
    const eta = stopEtas.get(stopId);
    await Delivery.updateOne(
      { _id: stopId },
      {
        routeOrder: i + 1,
        runId: run!._id,
        status: "scheduled",
        warehouseReadyAt,
        ...(eta
          ? {
              estimatedArrival: eta.estimatedArrival,
              travelTimeMinutes: eta.travelTimeMinutes,
            }
          : {}),
      }
    );
  }

  await Rider.updateOne(
    { _id: input.riderId },
    { currentRunId: run!._id, predictedReturnAt: returnEta }
  );

  return {
    run,
    stops: optimized.stops.length,
    totalValue,
  };
}

/** Cluster-first fleet plan — priority-scored, ETA-feasible, load-balanced */
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

  for (const [, list] of byCluster) {
    list.sort((a, b) => compareDeliveriesByDispatchPriority(a, b));
  }

  const clusterEntries = [...byCluster.entries()].sort((a, b) => {
    const priorityA = a[1].reduce((s, d) => s + (d.priorityScore ?? 0), 0);
    const priorityB = b[1].reduce((s, d) => s + (d.priorityScore ?? 0), 0);
    if (priorityB !== priorityA) return priorityB - priorityA;
    const valueA = a[1].reduce((s, d) => s + deliveryValue(d), 0);
    const valueB = b[1].reduce((s, d) => s + deliveryValue(d), 0);
    if (valueB !== valueA) return valueB - valueA;
    return b[1].length - a[1].length;
  });

  const usedRiders = new Set<string>();
  const riderBatchStops = new Map<string, number>();
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
      const bundleRiderId = await findClusterBundleRider({
        companyId: input.companyId,
        branchId: input.branchId,
        clusterId,
      });

      if (bundleRiderId) {
        const riderId = String(bundleRiderId);
        const batchLoad = riderBatchStops.get(riderId) ?? (await countPendingRouteLoad(bundleRiderId));
        if (batchLoad < MAX_STOPS_PER_OPTIMISE_PASS) {
          const runResult = await assignDeliveriesToRiderRun({
            companyId: input.companyId,
            branchId: input.branchId,
            riderId: bundleRiderId,
            deliveries: clusterDeliveries,
            origin,
            now,
            clusterId,
          });
          if (runResult) {
            usedRiders.add(riderId);
            riderBatchStops.set(riderId, batchLoad + clusterDeliveries.length);
            results.push({
              riderId,
              runId: String(runResult.run._id),
              clusterId: clusterKey,
              stops: runResult.stops,
              totalValue: runResult.totalValue,
            });
            continue;
          }
        }
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

    if (!rider) {
      for (const d of clusterDeliveries) {
        await Delivery.updateOne(
          { _id: d._id },
          {
            status: "pending_assignment",
            riderId: undefined,
            provisionalRiderId: undefined,
            runId: undefined,
            routeOrder: undefined,
          }
        );
      }
      continue;
    }

    const riderId = rider._id;
    const batchLoad = riderBatchStops.get(String(riderId)) ?? (await countPendingRouteLoad(riderId));
    if (batchLoad + clusterDeliveries.length > MAX_STOPS_PER_OPTIMISE_PASS) {
      for (const d of clusterDeliveries) {
        await Delivery.updateOne(
          { _id: d._id },
          {
            status: "pending_assignment",
            riderId: undefined,
            provisionalRiderId: undefined,
            runId: undefined,
            routeOrder: undefined,
          }
        );
      }
      continue;
    }

    usedRiders.add(String(riderId));
    riderBatchStops.set(String(riderId), batchLoad + clusterDeliveries.length);

    const runResult = await assignDeliveriesToRiderRun({
      companyId: input.companyId,
      branchId: input.branchId,
      riderId,
      deliveries: clusterDeliveries,
      origin,
      now,
      clusterId,
    });

    if (runResult) {
      results.push({
        riderId: String(riderId),
        runId: String(runResult.run._id),
        clusterId: clusterKey,
        stops: runResult.stops,
        totalValue: runResult.totalValue,
      });
    }
  }

  await assignGreedyByPriority({
    companyId: input.companyId,
    branchId: input.branchId,
    origin,
    now,
    warehouseReadyAt,
    riderBatchStops,
    results,
  });

  await refreshDeliveryPromiseEstimates(input.companyId, input.branchId);

  return { trigger: input.trigger, optimised: results };
}

/** Second pass: assign remaining pending orders one-by-one by priority */
async function assignGreedyByPriority(input: {
  companyId: string;
  branchId: string;
  origin: { lat: number; lng: number };
  now: Date;
  warehouseReadyAt: Date;
  riderBatchStops: Map<string, number>;
  results: {
    riderId: string;
    runId: string;
    clusterId: string;
    stops: number;
    totalValue: number;
  }[];
}) {
  const pending = await Delivery.find({
    companyId: input.companyId,
    branchId: input.branchId,
    deletedAt: null,
    status: "pending_assignment",
    assignmentLocked: false,
    currentDestinationLocked: false,
    warehouseStatus: { $nin: ["dispatched"] },
  })
    .populate("saleId", "totalAmount")
    .lean();

  const sorted = (pending as DeliveryLean[]).sort((a, b) =>
    compareDeliveriesByDispatchPriority(a, b)
  );

  for (const d of sorted) {
    const clusterId = d.clusterId ? String(d.clusterId) : undefined;
    const rider = await pickBestRiderForCluster({
      companyId: input.companyId,
      branchId: input.branchId,
      clusterId,
      deliveries: [d],
      excludeRiderIds: new Set(),
      warehouseReadyAt: input.warehouseReadyAt,
    });
    if (!rider) continue;

    const riderId = String(rider._id);
    const batchLoad =
      input.riderBatchStops.get(riderId) ?? (await countPendingRouteLoad(rider._id));
    if (batchLoad >= MAX_STOPS_PER_OPTIMISE_PASS) continue;

    const runResult = await assignDeliveriesToRiderRun({
      companyId: input.companyId,
      branchId: input.branchId,
      riderId: rider._id,
      deliveries: [d],
      origin: input.origin,
      now: input.now,
      clusterId,
    });

    if (runResult) {
      input.riderBatchStops.set(riderId, batchLoad + 1);
      input.results.push({
        riderId,
        runId: String(runResult.run._id),
        clusterId: clusterId ?? "unclustered",
        stops: runResult.stops,
        totalValue: runResult.totalValue,
      });
    }
  }
}

async function autoAssignIdleRidersAtWarehouse(companyId: string, branchId: string) {
  const riders = await Rider.find({
    companyId,
    branchId,
    deletedAt: null,
    isOnShift: true,
    isOnJourney: false,
    status: { $nin: ["offline", "inactive", "off_duty", "break", "on_delivery", "loading"] },
  })
    .select("_id")
    .lean();

  let assigned = 0;
  for (const rider of riders) {
    if (!(await canRiderAcceptNewOrders(rider._id))) continue;
    const result = await assignNextRouteToRider(rider._id);
    assigned += result.assigned;
  }

  return { ridersChecked: riders.length, ordersAssigned: assigned };
}

function branchDispatchKey(companyId: string, branchId: string) {
  return `${companyId}:${branchId}`;
}

/** Full automated cycle: prep advance → re-score → idle riders → fleet optimise */
export async function runDispatchCycle(input: {
  companyId: string;
  branchId: string;
  trigger: string;
}) {
  await autoAdvanceWarehousePrep(input.companyId, input.branchId);
  await refreshQueuePriorities(input.companyId, input.branchId);
  await autoAssignIdleRidersAtWarehouse(input.companyId, input.branchId);
  return optimiseFleetPlan(input);
}

/** Debounced optimise — coalesces burst events into one cycle */
export function scheduleFleetOptimise(input: {
  companyId: string;
  branchId: string;
  trigger: string;
}) {
  const key = branchDispatchKey(input.companyId, input.branchId);
  const existing = pendingOptimise.get(key);
  if (existing) clearTimeout(existing);

  pendingOptimise.set(
    key,
    setTimeout(() => {
      pendingOptimise.delete(key);
      void runDispatchCycle(input).catch((err) => {
        console.error("[dispatch] scheduled optimise failed", err);
      });
    }, DISPATCH_CONFIG.optimiseDebounceMs)
  );
}

/** Periodic background optimise for branches with riders on shift */
export function ensureBackgroundDispatchLoop() {
  if (backgroundDispatchStarted) return;
  backgroundDispatchStarted = true;

  setInterval(() => {
    void (async () => {
      const activeBranches = await Rider.distinct("branchId", {
        deletedAt: null,
        isOnShift: true,
      });

      for (const branchId of activeBranches) {
        const rider = await Rider.findOne({ branchId, isOnShift: true })
          .select("companyId")
          .lean();
        if (!rider?.companyId) continue;

        const companyId = String(rider.companyId);
        const key = branchDispatchKey(companyId, String(branchId));
        if (pendingOptimise.has(key)) continue;

        void runDispatchCycle({
          companyId,
          branchId: String(branchId),
          trigger: "background",
        }).catch(() => {});
      }
    })();
  }, DISPATCH_CONFIG.backgroundOptimiseIntervalMs);
}

/** Mark the rider's active run complete when back at warehouse with no pending stops. */
export async function completeRiderRun(riderId: mongoose.Types.ObjectId | string) {
  const rider = await Rider.findById(riderId);
  if (!rider) return null;

  const now = new Date();
  await DeliveryRun.updateMany(
    {
      riderId: rider._id,
      status: { $in: ["active", "returning"] },
    },
    { status: "completed", endedAt: now }
  );

  rider.isOnJourney = false;
  rider.status = "available";
  rider.predictedReturnAt = undefined;
  await rider.save();
  return rider;
}

export async function countUndeliveredStops(riderId: mongoose.Types.ObjectId | string) {
  return Delivery.countDocuments({
    riderId,
    deletedAt: null,
    status: { $in: ["scheduled", "in_transit"] },
  });
}

/** Assign the next queued batch to a rider waiting at the warehouse. */
export async function assignNextRouteToRider(riderId: mongoose.Types.ObjectId | string) {
  const rider = await Rider.findById(riderId);
  if (!rider || !(await canRiderAcceptNewOrders(riderId))) {
    return { assigned: 0 };
  }

  const branch = await Branch.findById(rider.branchId).lean();
  const origin = branch?.gpsCoordinates ?? { lat: 23.588, lng: 58.3829 };
  const now = new Date();

  const queued = await Delivery.find({
    companyId: rider.companyId,
    branchId: rider.branchId,
    deletedAt: null,
    status: "pending_assignment",
    assignmentLocked: false,
    currentDestinationLocked: false,
    warehouseStatus: { $nin: ["dispatched"] },
  })
    .populate("saleId", "totalAmount")
    .sort({ priorityScore: -1, promisedWindowStart: 1, createdAt: 1 })
    .lean();

  const capacity = riderCapacity(rider);
  const currentLoad = await countPendingRouteLoad(rider._id);
  const slots = Math.min(MAX_STOPS_PER_OPTIMISE_PASS - currentLoad, capacity - currentLoad);
  if (slots <= 0 || !queued.length) return { assigned: 0 };

  const toAssign = queued.slice(0, slots) as DeliveryLean[];
  const runResult = await assignDeliveriesToRiderRun({
    companyId: String(rider.companyId),
    branchId: String(rider.branchId),
    riderId: rider._id,
    deliveries: toAssign,
    origin,
    now,
  });

  return {
    assigned: toAssign.length,
    runId: runResult?.run ? String(runResult.run._id) : undefined,
    runNumber: runResult?.run?.runNumber,
  };
}

/**
 * Rider finished all stops and is back at warehouse — complete prior run and plan the next one.
 */
export async function onRiderBackAtWarehouse(riderId: mongoose.Types.ObjectId | string) {
  const rider = await Rider.findById(riderId);
  if (!rider) return { completed: false, assigned: 0 };

  const remaining = await countUndeliveredStops(riderId);
  if (remaining > 0) {
    rider.status = "returning_to_warehouse";
    rider.isOnJourney = false;
    rider.predictedReturnAt = new Date(Date.now() + 20 * 60000);
    await rider.save();
    return { completed: false, assigned: 0, remainingStops: remaining };
  }

  await completeRiderRun(riderId);
  const next = await assignNextRouteToRider(riderId);

  void scheduleFleetOptimise({
    companyId: String(rider.companyId),
    branchId: String(rider.branchId),
    trigger: "rider_back_at_warehouse",
  });

  return { completed: true, ...next };
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
    void scheduleFleetOptimise({
      companyId: String(delivery.companyId),
      branchId: String(delivery.branchId),
      trigger: `warehouse_${status}`,
    });
  }

  if (status === "dispatched") {
    await lockDeliveryAssignment(deliveryId);
    void scheduleFleetOptimise({
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
  void scheduleFleetOptimise({
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

  const result = await runDispatchCycle({
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

  void scheduleFleetOptimise({
    companyId: String(delivery.companyId),
    branchId: String(delivery.branchId),
    trigger: "customer_unavailable",
  });

  return windows;
}

/** Fleet snapshot for dispatch dashboard */
export async function getFleetDispatchSnapshot(
  companyId: string,
  branchId: string,
  dateRange: { start: Date; end: Date }
) {
  const branchIds = await expandMainBranchIds(branchId);
  const branchFilter = branchIdFilter(branchId, branchIds);
  const dateFilter = deliveryInDateRangeQuery(dateRange.start, dateRange.end);
  const runDateFilter = scheduledDateInRangeQuery(dateRange.start, dateRange.end);

  const deliveries = await Delivery.find({
    companyId,
    branchId: branchFilter,
    deletedAt: null,
    status: { $nin: ["cancelled"] },
    ...dateFilter,
  })
    .populate("saleId", "totalAmount")
    .populate("clusterId", "code name")
    .lean();

  const bySource: Record<string, number> = {};
  const clusterMap = new Map<string, { clusterId: string; code: string; count: number; totalValue: number }>();

  for (const d of deliveries) {
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
    branchId: branchFilter,
    deletedAt: null,
    status: { $nin: ["inactive", "off_duty"] },
  }).lean();

  const activeRiderIds = new Set(
    deliveries
      .filter((d) => d.riderId)
      .map((d) => String(d.riderId))
  );

  const riderSnapshots = await Promise.all(
    riders
      .filter((r) => activeRiderIds.has(String(r._id)))
      .map(async (r) => {
      const stops = await Delivery.countDocuments({
        riderId: r._id,
        deletedAt: null,
        status: { $in: ["scheduled", "in_transit"] },
        ...dateFilter,
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
    branchId: branchFilter,
    status: { $nin: ["cancelled"] },
    ...runDateFilter,
  })
    .populate("riderId", "riderCode")
    .lean();

  return {
    totalDeliveries: deliveries.length,
    activeRiders: activeRiderIds.size,
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
