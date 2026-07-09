import type { Request, Response } from "express";
import { Rider } from "../models/Rider.model";
import { Delivery } from "../models/Delivery.model";
import { Employee } from "../models/Employee.model";
import { Branch } from "../models/Branch.model";
import { planRoadRouteRoundTrip } from "../services/route-optimization.service";
import { buildTenantFilter } from "../services/permission.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { deliveryInDateRangeQuery, formatLocalDate, parseDeliveryDateRange } from "../utils/deliveryDateFilter";
import { branchIdFilter, expandMainBranchIds } from "../utils/branchScope";

export async function listRiders(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.branchId) {
    const mainId = String(req.query.branchId);
    const branchIds = await expandMainBranchIds(mainId);
    filter.branchId = branchIdFilter(mainId, branchIds);
  }
  if (req.query.search) {
    filter.$or = [
      { riderCode: new RegExp(String(req.query.search), "i") },
      { vehiclePlate: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Rider.find(filter)
      .populate("employeeId", "firstName lastName email phone employeeId status department designation")
      .populate("branchId", "name code")
      .sort(buildSortQuery(sortBy ?? "createdAt", sortOrder ?? "desc"))
      .skip(skip)
      .limit(limit)
      .lean(),
    Rider.countDocuments(filter),
  ]);

  const withStats = await Promise.all(
    items.map(async (rider) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [todayDeliveries, activeDeliveries] = await Promise.all([
        Delivery.countDocuments({
          riderId: rider._id,
          scheduledDate: { $gte: today, $lt: tomorrow },
          deletedAt: null,
          status: { $nin: ["cancelled", "delivered"] },
        }),
        Delivery.countDocuments({
          riderId: rider._id,
          status: "in_transit",
          deletedAt: null,
        }),
      ]);

      return { ...rider, todayDeliveries, activeDeliveries };
    })
  );

  return sendSuccess(res, withStats, 200, buildMeta(page, limit, total));
}

export async function getRider(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const rider = await Rider.findOne({ _id: req.params.id, ...tenant, deletedAt: null })
    .populate("employeeId")
    .populate("branchId", "name code address gpsCoordinates")
    .lean();

  if (!rider) throw new AppError("NOT_FOUND", "Rider not found", 404);

  const deliveries = await Delivery.find({ riderId: rider._id, deletedAt: null })
    .populate("customerId", "name phone address area")
    .populate("saleId", "saleNumber quantity totalAmount")
    .sort({ scheduledDate: -1, routeOrder: 1 })
    .limit(50)
    .lean();

  return sendSuccess(res, { ...rider, recentDeliveries: deliveries });
}

export async function updateRider(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const rider = await Rider.findOne({ _id: req.params.id, ...tenant, deletedAt: null });
  if (!rider) throw new AppError("NOT_FOUND", "Rider not found", 404);

  const { status, vehicleMake, vehicleModel, vehiclePlate, whatsappPhone } = req.body as {
    status?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    whatsappPhone?: string;
  };

  if (status) rider.status = status as typeof rider.status;
  if (vehicleMake !== undefined) rider.vehicleMake = vehicleMake;
  if (vehicleModel !== undefined) rider.vehicleModel = vehicleModel;
  if (vehiclePlate !== undefined) rider.vehiclePlate = vehiclePlate;
  if (whatsappPhone !== undefined) rider.whatsappPhone = whatsappPhone;
  rider.updatedBy = req.user!._id;
  await rider.save();

  const populated = await Rider.findById(rider._id)
    .populate("employeeId", "firstName lastName email phone")
    .populate("branchId", "name code")
    .lean();

  return sendSuccess(res, populated);
}

export async function updateRiderLocation(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const rider = await Rider.findOne({ _id: req.params.id, ...tenant, deletedAt: null });
  if (!rider) throw new AppError("NOT_FOUND", "Rider not found", 404);

  if (req.user!.role === "rider") {
    if (String(rider.employeeId) !== String(req.user!.employeeId)) {
      throw new AppError("FORBIDDEN", "You can only update your own location", 403);
    }
  }

  const { lat, lng } = req.body as { lat: number; lng: number };
  rider.currentLocation = { lat, lng, updatedAt: new Date() };
  await rider.save();

  return sendSuccess(res, { lat, lng, updatedAt: rider.currentLocation.updatedAt });
}

export async function getRiderByEmployee(req: Request, res: Response) {
  const employee = await Employee.findOne({
    _id: req.params.employeeId,
    ...buildTenantFilter(req.user!),
    deletedAt: null,
  });
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);

  const rider = await Rider.findOne({ employeeId: employee._id, deletedAt: null })
    .populate("branchId", "name code")
    .lean();

  return sendSuccess(res, rider);
}

export async function listLiveRiders(req: Request, res: Response) {
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null, status: { $ne: "inactive" } };
  if (req.query.branchId) {
    const mainId = String(req.query.branchId);
    const branchIds = await expandMainBranchIds(mainId);
    filter.branchId = branchIdFilter(mainId, branchIds);
  }

  const riders = await Rider.find(filter)
    .populate("employeeId", "firstName lastName phone")
    .select("riderCode status isOnJourney currentLocation employeeId branchId")
    .lean();

  const withActive = await Promise.all(
    riders.map(async (rider) => {
      const activeDelivery = await Delivery.findOne({
        riderId: rider._id,
        status: "in_transit",
        deletedAt: null,
      })
        .populate("customerId", "name phone address")
        .populate("saleId", "saleNumber")
        .lean();

      const remaining = await Delivery.countDocuments({
        riderId: rider._id,
        status: { $in: ["scheduled", "in_transit"] },
        deletedAt: null,
      });

      return { ...rider, activeDelivery, remainingStops: remaining };
    })
  );

  return sendSuccess(res, withActive);
}

/** Live rider positions plus shortest planned route from warehouse to assigned stops */
export async function listRiderLocationsWithRoutes(req: Request, res: Response) {
  const { start, end, dateFrom, dateTo } = parseDeliveryDateRange(req.query as Record<string, unknown>);
  const dateFilter = deliveryInDateRangeQuery(start, end);

  const filter: Record<string, unknown> = {
    ...buildTenantFilter(req.user!),
    deletedAt: null,
    status: { $ne: "inactive" },
  };
  if (req.query.branchId) {
    const mainId = String(req.query.branchId);
    const branchIds = await expandMainBranchIds(mainId);
    filter.branchId = branchIdFilter(mainId, branchIds);
  }

  const riders = await Rider.find(filter)
    .populate("employeeId", "firstName lastName phone")
    .select("riderCode status isOnShift isOnJourney currentLocation employeeId branchId")
    .lean();

  const branchIds = [...new Set(riders.map((r) => String(r.branchId)))];
  const branches = await Branch.find({ _id: { $in: branchIds } })
    .select("gpsCoordinates name")
    .lean();
  const warehouseByBranch = new Map(
    branches.map((b) => [String(b._id), b.gpsCoordinates ?? { lat: 23.588, lng: 58.3829 }])
  );

  const snapshots = await Promise.all(
    riders.map(async (rider) => {
      const activeDelivery = await Delivery.findOne({
        riderId: rider._id,
        status: "in_transit",
        deletedAt: null,
        ...dateFilter,
      })
        .populate("customerId", "name phone address")
        .populate("saleId", "saleNumber")
        .lean();

      const assigned = await Delivery.find({
        riderId: rider._id,
        deletedAt: null,
        status: { $nin: ["cancelled"] },
        "coordinates.lat": { $exists: true },
        ...dateFilter,
      })
        .populate("customerId", "name phone")
        .sort({ routeOrder: 1, promisedWindowStart: 1, createdAt: 1 })
        .lean();

      const remainingStops = assigned.length;
      const origin = warehouseByBranch.get(String(rider.branchId)) ?? { lat: 23.588, lng: 58.3829 };

      let route: {
        points: { lat: number; lng: number; label?: string; deliveryId?: string; order: number }[];
        pathGeometry: { lat: number; lng: number }[];
        outboundDistanceKm: number;
        returnDistanceKm: number;
        roundTripDistanceKm: number;
        totalDurationMin: number;
        roundTripCost: number;
        costPerKm: number;
        stopCount: number;
      } | null = null;

      const stops = assigned
        .filter((d) => d.coordinates?.lat != null && d.coordinates?.lng != null)
        .map((d) => ({
          id: String(d._id),
          lat: d.coordinates!.lat,
          lng: d.coordinates!.lng,
        }));

      if (stops.length > 0) {
        const { optimized, road } = await planRoadRouteRoundTrip(origin, stops);
        route = {
          points: optimized.stops.map((s, i) => {
            const del = assigned.find((d) => String(d._id) === s.id);
            const customer = del?.customerId as { name?: string; phone?: string } | undefined;
            return {
              lat: s.lat,
              lng: s.lng,
              deliveryId: s.id,
              order: i + 1,
              label: customer?.name ?? customer?.phone ?? `Stop ${i + 1}`,
            };
          }),
          pathGeometry: road?.pathGeometry ?? [],
          outboundDistanceKm: road?.outboundDistanceKm ?? optimized.totalDistanceMeters / 1000,
          returnDistanceKm: road?.returnDistanceKm ?? 0,
          roundTripDistanceKm: road?.roundTripDistanceKm ?? optimized.totalDistanceMeters / 1000,
          totalDurationMin: road?.roundTripDurationMin ?? Math.round(optimized.totalDurationSeconds / 60),
          roundTripCost: road?.roundTripCost ?? (optimized.totalDistanceMeters / 1000) * 10,
          costPerKm: road?.costPerKm ?? 10,
          stopCount: optimized.stops.length,
        };
      }

      return {
        ...rider,
        currentLocation: rider.isOnShift ? rider.currentLocation : undefined,
        activeDelivery,
        remainingStops,
        route,
        warehouse: origin,
      };
    })
  );

  const deliveryCount = snapshots.reduce((n, r) => n + (r.route?.stopCount ?? 0), 0);
  const totalRouteCost = snapshots.reduce((n, r) => n + (r.route?.roundTripCost ?? 0), 0);
  const totalRoundTripKm = snapshots.reduce((n, r) => n + (r.route?.roundTripDistanceKm ?? 0), 0);

  return sendSuccess(res, {
    dateFrom,
    dateTo,
    deliveryCount,
    totalRouteCost,
    totalRoundTripKm,
    riders: snapshots,
  });
}
