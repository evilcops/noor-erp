import type { Request, Response } from "express";
import { Rider } from "../models/Rider.model";
import { Delivery } from "../models/Delivery.model";
import { Employee } from "../models/Employee.model";
import { buildTenantFilter } from "../services/permission.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

export async function listRiders(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.branchId) filter.branchId = req.query.branchId;
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
  if (req.query.branchId) filter.branchId = req.query.branchId;

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
