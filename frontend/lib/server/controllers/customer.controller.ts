import type { Request, Response } from "express";
import mongoose from "mongoose";
import { normalizePhone, phoneLookupVariants } from "@/lib/phone";
import type { HydratedDocument } from "mongoose";
import { Customer, type ICustomer } from "../models/Customer.model";
import { Sale } from "../models/Sale.model";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";
import { Branch } from "../models/Branch.model";
import {
  assertBranchAccess,
  assertCompanyAccess,
  buildTenantFilter,
  resolveRequestTenant,
} from "../services/permission.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import {
  syncProductStockStatus,
  updateStockLevel,
} from "../services/inventory.service";
import { notifyLowStock } from "../services/inventory-notification.service";
import { createDeliveryFromSale } from "../services/delivery.service";
import { resolveClusterForCompanyPoint } from "../services/cluster-grid.service";
import { geocodeAddress } from "../services/geocoding.service";
import { logger } from "../utils/logger";

interface CustomerLocation {
  coordinates?: { lat: number; lng: number };
  clusterId?: mongoose.Types.ObjectId | null;
  branchId?: mongoose.Types.ObjectId | null;
}

/**
 * Resolve a customer's coordinates (from map pin or by geocoding the address) and
 * find the delivery cluster that covers them. Returns nulls when outside all clusters.
 */
async function resolveCustomerLocation(
  companyId: string,
  data: { address?: string; coordinates?: { lat: number; lng: number } }
): Promise<CustomerLocation> {
  let coordinates =
    data.coordinates?.lat != null && data.coordinates?.lng != null
      ? { lat: data.coordinates.lat, lng: data.coordinates.lng }
      : undefined;

  // Location enrichment (geocoding + cluster match) must never block saving a customer.
  try {
    if (!coordinates && data.address?.trim()) {
      coordinates = (await geocodeAddress(data.address)) ?? undefined;
    }

    if (!coordinates) return { coordinates: undefined, clusterId: null, branchId: null };

    const cluster = await resolveClusterForCompanyPoint(companyId, coordinates);
    return {
      coordinates,
      clusterId: cluster?._id ?? null,
      branchId: cluster?.branchId ?? null,
    };
  } catch (error) {
    logger.error("Customer location resolution failed", { error });
    return { coordinates, clusterId: null, branchId: null };
  }
}

async function generateSaleNumber(companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `SAL-${year}-`;
  const count = await Sale.countDocuments({
    companyId,
    saleNumber: new RegExp(`^${prefix}`),
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

async function findCustomerByPhone(companyId: string, phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  let customer = await Customer.findOne({ companyId, deletedAt: null, phone: normalized });
  if (customer) return customer;

  const legacyVariants = phoneLookupVariants(phone).filter((v) => v !== normalized);
  if (legacyVariants.length === 0) return null;

  return Customer.findOne({
    companyId,
    deletedAt: null,
    phone: { $in: legacyVariants },
  });
}

async function findOrCreateCustomer(
  companyId: string,
  data: { phone: string; email?: string; name?: string; address?: string; area?: string },
  userId: string
): Promise<{ customer: HydratedDocument<ICustomer>; created: boolean }> {
  const phone = normalizePhone(data.phone);
  if (!phone) {
    throw new AppError("BAD_REQUEST", "A valid customer phone number is required", 400);
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  let customer = await findCustomerByPhone(companyId, data.phone);

  if (customer) {
    if (data.email?.trim() && !customer.email) customer.email = data.email.trim();
    if (data.name?.trim() && !customer.name) customer.name = data.name.trim();
    if (data.address?.trim()) customer.address = data.address.trim();
    if (data.area?.trim()) customer.area = data.area.trim();
    if (customer.phone !== phone) customer.phone = phone;
    if (!customer.coordinates?.lat && customer.address) {
      const location = await resolveCustomerLocation(companyId, { address: customer.address });
      if (location.coordinates) {
        customer.coordinates = location.coordinates;
        customer.clusterId = location.clusterId;
        customer.branchId = location.branchId;
      }
    }
    customer.updatedBy = userObjectId;
    await customer.save();
    return { customer, created: false };
  }

  const location = await resolveCustomerLocation(companyId, { address: data.address });
  const created = await Customer.create({
    companyId,
    phone,
    email: data.email?.trim() || undefined,
    name: data.name?.trim() || undefined,
    address: data.address?.trim() || undefined,
    area: data.area?.trim() || undefined,
    coordinates: location.coordinates,
    clusterId: location.clusterId,
    branchId: location.branchId,
    createdBy: userObjectId,
    updatedBy: userObjectId,
  });
  return { customer: created, created: true };
}

export async function createCustomer(req: Request, res: Response) {
  const { companyId } = await resolveRequestTenant(req.user!, {
    companyId: req.body.companyId,
    branchId: req.body.branchId,
  });

  const phone = normalizePhone(req.body.phone);
  if (!phone) {
    throw new AppError("BAD_REQUEST", "A valid customer phone number is required", 400);
  }

  const existing = await findCustomerByPhone(companyId, req.body.phone);
  if (existing) {
    throw new AppError(
      "CONFLICT",
      `A customer with this phone already exists${existing.name ? `: ${existing.name}` : ""}. Use the existing customer or a different phone number.`,
      409
    );
  }

  const userObjectId = new mongoose.Types.ObjectId(String(req.user!._id));
  const location = await resolveCustomerLocation(companyId, {
    address: req.body.address,
    coordinates: req.body.coordinates,
  });

  const customer = await Customer.create({
    companyId,
    phone,
    email: req.body.email?.trim() || undefined,
    name: req.body.name?.trim() || undefined,
    address: req.body.address?.trim() || undefined,
    area: req.body.area?.trim() || undefined,
    coordinates: location.coordinates,
    clusterId: location.clusterId,
    branchId: location.branchId,
    notes: req.body.notes?.trim() || undefined,
    createdBy: userObjectId,
    updatedBy: userObjectId,
  });

  const populated = await Customer.findById(customer._id)
    .populate("clusterId", "code name")
    .lean();

  return sendSuccess(res, populated ?? customer.toObject(), 201);
}

export async function listCustomers(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.search) {
    const q = new RegExp(String(req.query.search), "i");
    filter.$or = [{ name: q }, { phone: q }, { email: q }];
  }

  const [items, total] = await Promise.all([
    Customer.find(filter)
      .populate("clusterId", "code name")
      .sort(buildSortQuery(sortBy ?? "createdAt", sortOrder ?? "desc"))
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);

  const withStats = await Promise.all(
    items.map(async (c) => {
      const sales = await Sale.find({ customerId: c._id }).sort({ createdAt: -1 }).lean();
      const totalSpent = sales.reduce((sum, s) => sum + s.totalAmount, 0);
      return {
        ...c,
        totalPurchases: sales.length,
        totalSpent,
        lastPurchaseAt: sales[0]?.createdAt ?? null,
      };
    })
  );

  return sendSuccess(res, withStats, 200, buildMeta(page, limit, total));
}

export async function resolveCustomerCluster(req: Request, res: Response) {
  const { companyId } = await resolveRequestTenant(req.user!, {
    companyId: typeof req.query.companyId === "string" ? req.query.companyId : undefined,
    branchId: typeof req.query.branchId === "string" ? req.query.branchId : undefined,
  });

  const address = typeof req.query.address === "string" ? req.query.address : undefined;
  const latRaw = req.query.lat;
  const lngRaw = req.query.lng;

  let coordinates: { lat: number; lng: number } | undefined;
  if (latRaw != null && latRaw !== "" && lngRaw != null && lngRaw !== "") {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) coordinates = { lat, lng };
  }

  try {
    if (!coordinates && address?.trim()) {
      coordinates = (await geocodeAddress(address)) ?? undefined;
    }

    if (!coordinates) {
      return sendSuccess(res, { coordinates: null, cluster: null, branch: null });
    }

    const cluster = await resolveClusterForCompanyPoint(companyId, coordinates);

    let branch: { _id: string; name?: string; code?: string } | null = null;
    if (cluster?.branchId) {
      const b = await Branch.findById(cluster.branchId).select("name code").lean();
      if (b) branch = { _id: String(b._id), name: b.name, code: b.code };
    }

    return sendSuccess(res, {
      coordinates,
      cluster: cluster
        ? {
            _id: String(cluster._id),
            code: cluster.code,
            name: cluster.name,
            radiusKm: cluster.radiusKm,
          }
        : null,
      branch,
    });
  } catch (error) {
    logger.error("resolveCustomerCluster failed", { error });
    return sendSuccess(res, { coordinates: coordinates ?? null, cluster: null, branch: null });
  }
}

export async function getCustomerStats(req: Request, res: Response) {
  const base = { ...buildTenantFilter(req.user!), deletedAt: null };

  const [total, withCoordinates, inCluster] = await Promise.all([
    Customer.countDocuments(base),
    Customer.countDocuments({ ...base, "coordinates.lat": { $ne: null, $exists: true } }),
    Customer.countDocuments({ ...base, clusterId: { $ne: null } }),
  ]);

  const noLocation = total - withCoordinates;
  const outsideClusters = Math.max(withCoordinates - inCluster, 0);

  return sendSuccess(res, {
    total,
    inCluster,
    outsideClusters,
    noLocation,
  });
}

export async function getCustomer(req: Request, res: Response) {
  const customer = await Customer.findOne({ _id: req.params.id, deletedAt: null })
    .populate("clusterId", "code name")
    .lean();
  if (!customer) throw new AppError("NOT_FOUND", "Customer not found", 404);

  const sales = await Sale.find({ customerId: customer._id })
    .populate("productId", "name sku code unitOfMeasure images")
    .populate("branchId", "name code")
    .populate("soldBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  const totalSpent = sales.reduce((sum, s) => sum + s.totalAmount, 0);

  return sendSuccess(res, {
    ...customer,
    sales,
    totalPurchases: sales.length,
    totalSpent,
  });
}

export async function updateCustomer(req: Request, res: Response) {
  const customer = await Customer.findOne({ _id: req.params.id, deletedAt: null });
  if (!customer) throw new AppError("NOT_FOUND", "Customer not found", 404);
  assertCompanyAccess(req.user!, String(customer.companyId));

  const body = req.body as {
    phone?: string;
    email?: string;
    name?: string;
    address?: string;
    area?: string;
    coordinates?: { lat: number; lng: number } | null;
    notes?: string;
  };

  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (!phone) throw new AppError("BAD_REQUEST", "A valid customer phone number is required", 400);
    if (phone !== customer.phone) {
      const dup = await findCustomerByPhone(String(customer.companyId), body.phone);
      if (dup && String(dup._id) !== String(customer._id)) {
        throw new AppError(
          "CONFLICT",
          `A customer with this phone already exists${dup.name ? `: ${dup.name}` : ""}.`,
          409
        );
      }
      customer.phone = phone;
    }
  }

  if (body.name !== undefined) customer.name = body.name.trim() || undefined;
  if (body.email !== undefined) customer.email = body.email?.trim() || undefined;
  if (body.area !== undefined) customer.area = body.area.trim() || undefined;
  if (body.notes !== undefined) customer.notes = body.notes.trim() || undefined;

  const addressProvided = body.address !== undefined;
  const coordsProvided = body.coordinates !== undefined;
  if (addressProvided) customer.address = body.address?.trim() || undefined;

  if (addressProvided || coordsProvided) {
    const location = await resolveCustomerLocation(String(customer.companyId), {
      address: customer.address,
      coordinates: body.coordinates ?? undefined,
    });
    customer.coordinates = location.coordinates;
    customer.clusterId = location.clusterId;
    customer.branchId = location.branchId;
  }

  customer.updatedBy = new mongoose.Types.ObjectId(String(req.user!._id));
  await customer.save();

  const populated = await Customer.findById(customer._id).populate("clusterId", "code name").lean();
  return sendSuccess(res, populated ?? customer.toObject());
}

export async function deleteCustomer(req: Request, res: Response) {
  const customer = await Customer.findOne({ _id: req.params.id, deletedAt: null });
  if (!customer) throw new AppError("NOT_FOUND", "Customer not found", 404);
  assertCompanyAccess(req.user!, String(customer.companyId));

  customer.deletedAt = new Date();
  customer.updatedBy = new mongoose.Types.ObjectId(String(req.user!._id));
  await customer.save();

  return sendSuccess(res, { message: "Customer deleted" });
}

export async function recordSale(req: Request, res: Response) {
  const { companyId, branchId } = await resolveRequestTenant(req.user!, {
    companyId: req.body.companyId,
    branchId: req.body.branchId,
  });

  const product = await Product.findOne({ _id: req.body.productId, deletedAt: null });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  const stock = await StockLevel.findOne({
    companyId,
    branchId,
    productId: req.body.productId,
  });

  if (!stock || stock.currentStock < req.body.quantity) {
    throw new AppError("BAD_REQUEST", "Insufficient stock for this sale", 400);
  }

  const unitPrice = req.body.unitPrice ?? product.sellingPrice ?? 0;
  const totalAmount = unitPrice * req.body.quantity;

  let customer;
  const customerId = req.body.customerId;
  const hasValidCustomerId = customerId && mongoose.isValidObjectId(customerId);

  if (hasValidCustomerId) {
    customer = await Customer.findOne({
      _id: customerId,
      companyId,
      deletedAt: null,
    });
    if (!customer) throw new AppError("NOT_FOUND", "Customer not found", 404);
  } else {
    const result = await findOrCreateCustomer(
      companyId,
      {
        phone: req.body.customerPhone,
        email: req.body.customerEmail,
        name: req.body.customerName,
        address: req.body.customerAddress,
        area: req.body.customerArea,
      },
      String(req.user!._id)
    );
    customer = result.customer;
    (req as Request & { customerCreated?: boolean }).customerCreated = result.created;
  }

  const saleNumber = await generateSaleNumber(companyId);
  const sale = await Sale.create({
    companyId,
    branchId,
    customerId: customer._id,
    productId: product._id,
    saleNumber,
    quantity: req.body.quantity,
    unitPrice,
    totalAmount,
    soldBy: req.user!._id,
    notes: req.body.notes,
  });

  const updatedStock = await updateStockLevel({
    companyId: product.companyId,
    branchId,
    productId: product._id,
    quantity: -req.body.quantity,
    type: "sale",
    reason: `Sale ${saleNumber} to ${customer.phone}`,
    referenceType: "Sale",
    referenceId: sale._id,
    userId: req.user!._id,
  });

  await syncProductStockStatus(product._id);

  const reorderLevel = updatedStock.reorderLevel ?? product.reorderLevel ?? 0;
  if (updatedStock.currentStock <= reorderLevel && reorderLevel > 0) {
    const branch = await Branch.findById(branchId).select("name");
    await notifyLowStock(
      product.companyId,
      product.name,
      branch?.name ?? "Branch",
      updatedStock.currentStock,
      reorderLevel
    );
  }

  const populated = await Sale.findById(sale._id)
    .populate("productId", "name sku")
    .populate("customerId", "name phone email address area")
    .populate("branchId", "name")
    .lean();

  const delivery = await createDeliveryFromSale(sale, customer, String(req.user!._id), {
    promisedWindowStart: req.body.promisedWindowStart
      ? new Date(req.body.promisedWindowStart)
      : undefined,
    promisedWindowEnd: req.body.promisedWindowEnd
      ? new Date(req.body.promisedWindowEnd)
      : undefined,
  });

  const rider = delivery?.riderId;
  const riderCode =
    rider && typeof rider === "object" && "riderCode" in rider
      ? (rider as { riderCode?: string }).riderCode
      : undefined;

  return sendSuccess(res, {
    ...populated,
    delivery,
    riderAssigned: Boolean(delivery?.riderId),
    riderCode,
    customerCreated: (req as Request & { customerCreated?: boolean }).customerCreated ?? false,
  }, 201);
}

export async function getSale(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const sale = await Sale.findOne({ _id: req.params.id, ...tenant })
    .populate("productId", "name sku code unitOfMeasure images")
    .populate("customerId", "name phone email")
    .populate("branchId", "name code")
    .populate("soldBy", "firstName lastName")
    .lean();
  if (!sale) throw new AppError("NOT_FOUND", "Sale not found", 404);

  return sendSuccess(res, sale);
}
