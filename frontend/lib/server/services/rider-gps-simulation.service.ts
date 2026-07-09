import { Branch } from "../models/Branch.model";
import { Rider } from "../models/Rider.model";
import { Delivery } from "../models/Delivery.model";
import { planRoadRouteRoundTrip } from "./route-optimization.service";
import { AppError } from "../utils/AppError";
import { expandMainBranchIds } from "../utils/branchScope";

export interface RiderGpsSimConfig {
  branchId: string;
  riderId?: string;
  dateFrom?: string;
  dateTo?: string;
  stepSize?: number;
  intervalMs?: number;
}

export interface RiderGpsUpdate {
  riderId: string;
  riderCode: string;
  lat: number;
  lng: number;
}

export interface RuntimeSimulationStatus {
  running: boolean;
  config: Omit<RiderGpsSimConfig, "stepSize" | "intervalMs"> & {
    stepSize: number;
    intervalMs: number;
  } | null;
  lastTickAt: string | null;
}

function parseSimDate(input?: string): Date {
  const iso = input?.trim() || new Date().toISOString().slice(0, 10);
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new AppError("BAD_REQUEST", "Invalid date", 400);
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) throw new AppError("BAD_REQUEST", "Invalid date", 400);
  return d;
}

function deliveryInDateRange(from: Date, to: Date) {
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return {
    $or: [
      { scheduledDate: { $gte: from, $lte: end } },
      { promisedWindowStart: { $gte: from, $lte: end } },
    ],
  };
}

function pathDistSq(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return dlat * dlat + dlng * dlng;
}

function advanceOnPath(
  path: { lat: number; lng: number }[],
  current: { lat: number; lng: number } | undefined,
  step: number
) {
  if (!path.length) return null;
  if (!current) return path[0];
  let idx = 0;
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = pathDistSq(current, path[i]);
    if (d < best) {
      best = d;
      idx = i;
    }
  }
  return path[Math.min(idx + step, path.length - 1)];
}

function normalizeConfig(config: RiderGpsSimConfig) {
  const dateFrom = config.dateFrom ?? config.dateTo ?? new Date().toISOString().slice(0, 10);
  const dateTo = config.dateTo ?? config.dateFrom ?? dateFrom;
  const start = parseSimDate(dateFrom);
  const end = parseSimDate(dateTo);
  if (start > end) {
    throw new AppError("BAD_REQUEST", "dateFrom must be on or before dateTo", 400);
  }
  return {
    branchId: config.branchId,
    riderId: config.riderId,
    dateFrom,
    dateTo,
    stepSize: Math.max(1, Math.min(50, config.stepSize ?? 4)),
    intervalMs: Math.max(1000, Math.min(30_000, config.intervalMs ?? 2000)),
    start,
    end,
  };
}

let runtimeTimer: ReturnType<typeof setInterval> | null = null;
let activeConfig: ReturnType<typeof normalizeConfig> | null = null;
let lastTickAt: Date | null = null;
let tickInFlight = false;

export function getRuntimeSimulationStatus(): RuntimeSimulationStatus {
  return {
    running: runtimeTimer !== null,
    config: activeConfig
      ? {
          branchId: activeConfig.branchId,
          riderId: activeConfig.riderId,
          dateFrom: activeConfig.dateFrom,
          dateTo: activeConfig.dateTo,
          stepSize: activeConfig.stepSize,
          intervalMs: activeConfig.intervalMs,
        }
      : null,
    lastTickAt: lastTickAt?.toISOString() ?? null,
  };
}

export function stopRuntimeSimulation() {
  if (runtimeTimer) clearInterval(runtimeTimer);
  runtimeTimer = null;
  activeConfig = null;
}

async function tickRuntimeSimulation() {
  if (tickInFlight || !activeConfig) return;
  tickInFlight = true;
  try {
    await moveRidersAlongRoutes(activeConfig, "step");
    lastTickAt = new Date();
  } catch (err) {
    console.error("[rider-gps-runtime]", err);
  } finally {
    tickInFlight = false;
  }
}

export async function startRuntimeSimulation(config: RiderGpsSimConfig) {
  if (!config.branchId) {
    throw new AppError("BAD_REQUEST", "branchId is required", 400);
  }

  stopRuntimeSimulation();
  activeConfig = normalizeConfig(config);
  await tickRuntimeSimulation();
  runtimeTimer = setInterval(() => {
    void tickRuntimeSimulation();
  }, activeConfig.intervalMs);
}

export async function moveRidersAlongRoutes(
  config: RiderGpsSimConfig,
  mode: "step" | "reset"
): Promise<RiderGpsUpdate[]> {
  const normalized = normalizeConfig(config);
  const branchIds = await expandMainBranchIds(normalized.branchId);
  const branchFilter = branchIds.length === 1 ? normalized.branchId : { $in: branchIds };

  const mainBranch = await Branch.findById(normalized.branchId).select("gpsCoordinates").lean();
  const warehouse = mainBranch?.gpsCoordinates ?? { lat: 23.588, lng: 58.3829 };

  const riderFilter: Record<string, unknown> = {
    branchId: branchFilter,
    deletedAt: null,
    status: { $ne: "inactive" },
  };
  if (normalized.riderId) riderFilter._id = normalized.riderId;

  const riders = await Rider.find(riderFilter).select("_id riderCode currentLocation branchId").lean();
  if (!riders.length) {
    throw new AppError("NOT_FOUND", "No riders found for this branch", 404);
  }

  const dateFilter = deliveryInDateRange(normalized.start, normalized.end);
  const updated: RiderGpsUpdate[] = [];

  for (const rider of riders) {
    const origin =
      (await Branch.findById(rider.branchId).select("gpsCoordinates").lean())?.gpsCoordinates ?? warehouse;

    const assigned = await Delivery.find({
      riderId: rider._id,
      deletedAt: null,
      status: { $nin: ["cancelled"] },
      "coordinates.lat": { $exists: true },
      ...dateFilter,
    })
      .sort({ routeOrder: 1, promisedWindowStart: 1, createdAt: 1 })
      .lean();

    const stops = assigned
      .filter((d) => d.coordinates?.lat != null && d.coordinates?.lng != null)
      .map((d) => ({
        id: String(d._id),
        lat: d.coordinates!.lat,
        lng: d.coordinates!.lng,
      }));

    let path: { lat: number; lng: number }[] = [];
    if (stops.length > 0) {
      const { road } = await planRoadRouteRoundTrip(origin, stops);
      path =
        road?.pathGeometry?.length
          ? road.pathGeometry
          : [origin, ...stops.map((s) => ({ lat: s.lat, lng: s.lng })), origin];
    }

    const current = rider.currentLocation
      ? { lat: rider.currentLocation.lat, lng: rider.currentLocation.lng }
      : undefined;

    let next: { lat: number; lng: number };
    if (mode === "reset" || !path.length) {
      next = origin;
    } else {
      const point = advanceOnPath(path, current, normalized.stepSize);
      next = point ?? origin;
    }

    await Rider.updateOne(
      { _id: rider._id },
      {
        $set: {
          currentLocation: { lat: next.lat, lng: next.lng, updatedAt: new Date() },
          isOnShift: true,
          isOnJourney: true,
          status: "on_delivery",
        },
      }
    );

    updated.push({
      riderId: String(rider._id),
      riderCode: rider.riderCode,
      lat: next.lat,
      lng: next.lng,
    });
  }

  return updated;
}
