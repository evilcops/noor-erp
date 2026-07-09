import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Company } from "../models/Company.model";
import { Branch } from "../models/Branch.model";
import { User } from "../models/User.model";
import { Employee } from "../models/Employee.model";
import { Product } from "../models/Product.model";
import { Customer } from "../models/Customer.model";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import { Rider } from "../models/Rider.model";
import { Sale } from "../models/Sale.model";
import { Delivery } from "../models/Delivery.model";
import { RiderJourney } from "../models/RiderJourney.model";
import { DeliveryRun } from "../models/DeliveryRun.model";
import { StockLevel } from "../models/StockLevel.model";
import { StockMovement } from "../models/StockMovement.model";
import { createDeliveryFromSale } from "../services/delivery.service";
import { optimiseFleetPlan } from "../services/dispatch-engine.service";
import {
  getRuntimeSimulationStatus,
  moveRidersAlongRoutes,
  startRuntimeSimulation,
  stopRuntimeSimulation,
} from "../services/rider-gps-simulation.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { branchIdFilter, expandMainBranchIds } from "../utils/branchScope";

async function branchIdsForMain(mainId: string) {
  return expandMainBranchIds(mainId);
}

function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

const RIDER_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

async function ensureRiders(
  companyId: mongoose.Types.ObjectId,
  branchId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  desired: number
) {
  const existing = await Rider.find({
    companyId,
    branchId,
    deletedAt: null,
    status: { $nin: ["inactive", "off_duty"] },
  }).lean();

  const created: string[] = [];
  const stamp = Date.now().toString().slice(-5);

  for (let i = existing.length; i < desired; i++) {
    const letter = RIDER_LETTERS[i] ?? String(i + 1);
    const emp = await Employee.create({
      employeeId: `RDR-${stamp}-${letter}`,
      companyId,
      branchId,
      firstName: "Rider",
      lastName: letter,
      email: `rider.${letter.toLowerCase()}.${stamp}@demo.local`,
      employmentType: "full_time",
      status: "active",
      hasVehicle: true,
      createdBy: userId,
    });
    const rider = await Rider.create({
      companyId,
      branchId,
      employeeId: emp._id,
      riderCode: `RIDER-${letter}-${stamp}`,
      status: "available",
      isOnShift: true,
      shiftStartedAt: new Date(),
      vehicleCapacityUnits: 20,
      createdBy: userId,
    });
    created.push(rider.riderCode);
  }

  return {
    existing: existing.map((r) => r.riderCode),
    created,
    total: existing.length + created.length,
  };
}

/**
 * DEV ONLY — create demo riders + orders and auto-assign them through the live
 * dispatch engine, using a real company + main branch so results show in the UI.
 *
 * POST /api/dev/fleet-seed
 * body: { companyId?, branchId?, riders?=4, ordersPerCluster?=2 }
 */
export async function seedFleet(req: Request, res: Response) {
  assertDev();

  const body = (req.body ?? {}) as {
    companyId?: string;
    branchId?: string;
    riders?: number;
    ordersPerCluster?: number;
  };

  const company = body.companyId
    ? await Company.findById(body.companyId).lean()
    : await Company.findOne({ deletedAt: null }).lean();
  if (!company) throw new AppError("NOT_FOUND", "No company found to seed into", 404);
  const companyId = company._id as mongoose.Types.ObjectId;

  // Prefer a branch that already has active clusters so orders auto-assign by cluster.
  let branch = body.branchId ? await Branch.findById(body.branchId).lean() : null;
  if (!branch) {
    const clusterBranchIds = await DeliveryCluster.distinct("branchId", {
      companyId,
      status: "active",
      deletedAt: null,
    });
    if (clusterBranchIds.length) {
      branch = await Branch.findOne({
        _id: { $in: clusterBranchIds },
        deletedAt: null,
      }).lean();
    }
  }
  if (!branch) {
    branch =
      (await Branch.findOne({ companyId, parentBranchId: null, deletedAt: null }).lean()) ??
      (await Branch.findOne({ companyId, deletedAt: null }).lean());
  }
  if (!branch) throw new AppError("NOT_FOUND", "No branch found to seed into", 404);
  const branchId = branch._id as mongoose.Types.ObjectId;

  const user =
    (await User.findOne({ companyId }).lean()) ?? (await User.findOne({ role: "super_admin" }).lean());
  if (!user) throw new AppError("NOT_FOUND", "No user found for createdBy", 404);
  const userId = user._id as mongoose.Types.ObjectId;

  const existingProduct = await Product.findOne({ companyId, deletedAt: null }).select("_id").lean();
  let productId: mongoose.Types.ObjectId;
  if (existingProduct) {
    productId = existingProduct._id as mongoose.Types.ObjectId;
  } else {
    const stamp = Date.now().toString().slice(-5);
    const newProduct = await Product.create({
      companyId,
      name: "Demo Case",
      code: `DEMO-${stamp}`,
      sku: `DEMO-SKU-${stamp}`,
      barcode: `96800000${stamp}`,
      qrCodeData: JSON.stringify({ sku: `DEMO-SKU-${stamp}` }),
      category: "Food",
      purchaseCost: 1,
      sellingPrice: 1,
      unitOfMeasure: "case",
      reorderLevel: 5,
      status: "active",
      createdBy: userId,
    });
    productId = newProduct._id as mongoose.Types.ObjectId;
  }

  const ridersInfo = await ensureRiders(companyId, branchId, userId, body.riders ?? 4);

  const clusters = await DeliveryCluster.find({
    companyId,
    branchId,
    status: "active",
    deletedAt: null,
  }).lean();

  const warehouse = branch.gpsCoordinates ?? { lat: 23.588, lng: 58.3829 };
  const perCluster = Math.max(1, body.ordersPerCluster ?? 2);

  // Build target points: each active cluster center, else fall back to warehouse.
  const targets: { label: string; center: { lat: number; lng: number } }[] = clusters.length
    ? clusters.map((c) => ({ label: c.name ?? c.code, center: c.center }))
    : [{ label: "Warehouse area", center: warehouse }];

  const values = [18000, 8000, 5000, 22000, 16000, 900, 60000, 12000];
  const stamp = Date.now().toString().slice(-6);
  const createdOrders: {
    order: string;
    cluster: string;
    value: number;
    rider: string | null;
    window: string;
  }[] = [];

  let n = 0;
  for (const target of targets) {
    for (let k = 0; k < perCluster; k++) {
      const jitter = k * 0.004;
      const coords = { lat: target.center.lat + jitter, lng: target.center.lng + jitter };
      const value = values[n % values.length];
      n += 1;

      const customer = await Customer.create({
        companyId,
        phone: `+96890${stamp}${String(n).padStart(2, "0")}`,
        name: `Demo ${target.label} #${k + 1}`,
        address: `${target.label} demo address ${k + 1}`,
        area: target.label,
        coordinates: coords,
        createdBy: userId,
      });

      const sale = await Sale.create({
        companyId,
        branchId,
        customerId: customer._id,
        productId,
        saleNumber: `DEMO-SAL-${stamp}-${String(n).padStart(3, "0")}`,
        quantity: 1,
        unitPrice: value,
        totalAmount: value,
        soldBy: userId,
      });

      const delivery = await createDeliveryFromSale(sale, customer, String(userId), {
        orderSource: "new_order",
      });

      const rider = delivery?.riderId
        ? await Rider.findById(delivery.riderId).select("riderCode").lean()
        : null;

      createdOrders.push({
        order: sale.saleNumber,
        cluster: target.label,
        value,
        rider: rider?.riderCode ?? null,
        window:
          delivery?.promisedWindowStart && delivery?.promisedWindowEnd
            ? `${new Date(delivery.promisedWindowStart).toISOString()} → ${new Date(
                delivery.promisedWindowEnd
              ).toISOString()}`
            : "—",
      });
    }
  }

  await optimiseFleetPlan({
    companyId: String(companyId),
    branchId: String(branchId),
    trigger: "dev_seed",
  });

  // Final assignment snapshot grouped by rider
  const dels = await Delivery.find({
    companyId,
    branchId,
    deletedAt: null,
    saleId: { $exists: true },
  })
    .populate("riderId", "riderCode")
    .populate("clusterId", "code name")
    .populate("saleId", "totalAmount saleNumber")
    .sort({ createdAt: -1 })
    .limit(targets.length * perCluster)
    .lean();

  const byRider: Record<string, { orders: number; clusters: Set<string> }> = {};
  for (const d of dels) {
    const code = (d.riderId as { riderCode?: string })?.riderCode ?? "unassigned";
    const cl = (d.clusterId as { name?: string; code?: string })?.name ?? "unclustered";
    byRider[code] = byRider[code] ?? { orders: 0, clusters: new Set() };
    byRider[code].orders += 1;
    byRider[code].clusters.add(cl);
  }

  return sendSuccess(res, {
    company: { id: String(companyId), name: company.name },
    branch: { id: String(branchId), name: branch.name },
    clustersFound: clusters.length,
    riders: ridersInfo,
    ordersCreated: createdOrders.length,
    orders: createdOrders,
    assignmentByRider: Object.fromEntries(
      Object.entries(byRider).map(([code, v]) => [code, { orders: v.orders, clusters: [...v.clusters] }])
    ),
  });
}

/**
 * DEV ONLY — empty the employee, rider and inventory collections and remove all
 * orders (sales, deliveries, delivery runs). Products, customers, branches,
 * companies and users are left untouched.
 *
 * POST /api/dev/reset
 */
export async function resetData(_req: Request, res: Response) {
  assertDev();

  const [
    employees,
    riders,
    riderJourneys,
    deliveries,
    deliveryRuns,
    sales,
    stockLevels,
    stockMovements,
  ] = await Promise.all([
    Employee.deleteMany({}),
    Rider.deleteMany({}),
    RiderJourney.deleteMany({}),
    Delivery.deleteMany({}),
    DeliveryRun.deleteMany({}),
    Sale.deleteMany({}),
    StockLevel.deleteMany({}),
    StockMovement.deleteMany({}),
  ]);

  return sendSuccess(res, {
    message: "Employees, riders, orders and inventory cleared. Products and customers kept.",
    deleted: {
      employees: employees.deletedCount ?? 0,
      riders: riders.deletedCount ?? 0,
      riderJourneys: riderJourneys.deletedCount ?? 0,
      deliveries: deliveries.deletedCount ?? 0,
      deliveryRuns: deliveryRuns.deletedCount ?? 0,
      sales: sales.deletedCount ?? 0,
      stockLevels: stockLevels.deletedCount ?? 0,
      stockMovements: stockMovements.deletedCount ?? 0,
    },
  });
}

/**
 * DEV ONLY — runtime rider GPS simulation along planned routes.
 *
 * POST /api/dev/simulate-rider-gps
 * body: { branchId, riderId?, dateFrom?, dateTo?, action?: "start"|"stop"|"reset"|"status", stepSize?, intervalMs? }
 */
export async function simulateRiderGps(req: Request, res: Response) {
  assertDev();

  const body = req.body as {
    branchId?: string;
    riderId?: string;
    dateFrom?: string;
    dateTo?: string;
    action?: "start" | "stop" | "reset" | "status";
    stepSize?: number;
    intervalMs?: number;
  };

  const action = body.action ?? "status";

  if (action === "status") {
    return sendSuccess(res, getRuntimeSimulationStatus());
  }

  if (action === "stop") {
    stopRuntimeSimulation();
    return sendSuccess(res, { action, ...getRuntimeSimulationStatus() });
  }

  if (!body.branchId) {
    throw new AppError("BAD_REQUEST", "branchId is required", 400);
  }

  const config = {
    branchId: body.branchId,
    riderId: body.riderId,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    stepSize: body.stepSize,
    intervalMs: body.intervalMs,
  };

  if (action === "start") {
    await startRuntimeSimulation(config);
    return sendSuccess(res, { action, ...getRuntimeSimulationStatus() });
  }

  if (action === "reset") {
    stopRuntimeSimulation();
    const updated = await moveRidersAlongRoutes(config, "reset");
    return sendSuccess(res, { action, updated, ...getRuntimeSimulationStatus() });
  }

  throw new AppError("BAD_REQUEST", "Invalid action", 400);
}
