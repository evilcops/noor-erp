import type { Request, Response } from "express";
import { StockLevel } from "../models/StockLevel.model";
import { StockMovement } from "../models/StockMovement.model";
import { Product } from "../models/Product.model";
import { PurchaseOrder } from "../models/PurchaseOrder.model";
import { StockTransfer } from "../models/StockTransfer.model";
import { Supplier } from "../models/Supplier.model";
import { Branch } from "../models/Branch.model";
import {
  assertBranchAccess,
  buildTenantFilter,
} from "../services/permission.service";
import {
  buildMeta,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { updateStockLevel, syncProductStockStatus, enrichStockAlert, isLowStockLevel } from "../services/inventory.service";
import { notifyLowStock } from "../services/inventory-notification.service";

export async function listStockLevels(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!) };

  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.productId) filter.productId = req.query.productId;
  if (req.query.lowStock === "true") {
    filter.$expr = { $lte: ["$currentStock", { $ifNull: ["$reorderLevel", 0] }] };
  }

  const [items, total] = await Promise.all([
    StockLevel.find(filter)
      .populate("productId", "name sku code unitOfMeasure minStockLevel reorderLevel status")
      .populate("branchId", "name code")
      .skip(skip)
      .limit(limit)
      .lean(),
    StockLevel.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function listMovements(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!) };

  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.productId) filter.productId = req.query.productId;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.fromDate || req.query.toDate) {
    filter.createdAt = {};
    if (req.query.fromDate) (filter.createdAt as Record<string, Date>).$gte = new Date(String(req.query.fromDate));
    if (req.query.toDate) {
      const to = new Date(String(req.query.toDate));
      to.setHours(23, 59, 59, 999);
      (filter.createdAt as Record<string, Date>).$lte = to;
    }
  }

  const [items, total] = await Promise.all([
    StockMovement.find(filter)
      .populate("productId", "name sku")
      .populate("branchId", "name code")
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function adjustStock(req: Request, res: Response) {
  if (req.user!.role !== "super_admin") {
    throw new AppError("FORBIDDEN", "Only super admin can adjust stock", 403);
  }

  const { branchId, productId, quantity, type, reason, notes } = req.body;

  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  assertBranchAccess(req.user!, branchId, product.companyId);

  const field =
    type === "damaged" ? "damagedStock" : type === "returned" ? "returnedStock" : "currentStock";

  const stock = await updateStockLevel({
    companyId: product.companyId,
    branchId,
    productId,
    quantity,
    type,
    reason,
    notes,
    userId: req.user!._id,
    field,
  });

  await syncProductStockStatus(productId);

  const reorderLevel = stock.reorderLevel ?? product.reorderLevel ?? 0;
  if (field === "currentStock" && stock.currentStock <= reorderLevel && reorderLevel > 0) {
    const branch = await Branch.findById(branchId).select("name");
    await notifyLowStock(
      product.companyId,
      product.name,
      branch?.name ?? "Branch",
      stock.currentStock,
      reorderLevel
    );
  }

  return sendSuccess(res, stock);
}

export async function listLowStock(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const levels = await StockLevel.find(tenant)
    .populate("productId", "name sku code reorderLevel minStockLevel status")
    .populate("branchId", "name code")
    .lean();

  const lowStock = levels
    .filter((l) => {
      const product = l.productId as { reorderLevel?: number; minStockLevel?: number; status?: string } | null;
      if (!product || product.status === "archived") return false;
      return isLowStockLevel(l.currentStock, l, product);
    })
    .map((l) => enrichStockAlert(l));

  return sendSuccess(res, lowStock);
}

export async function getInventoryDashboard(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const branchFilter = req.query.branchId ? { branchId: req.query.branchId } : {};

  const [
    totalProducts,
    stockLevels,
    pendingPurchases,
    inTransitPurchases,
    pendingTransfers,
    activeSuppliers,
    purchaseOrders,
  ] = await Promise.all([
    Product.countDocuments({ ...tenant, deletedAt: null, status: { $ne: "archived" } }),
    StockLevel.find({ ...tenant, ...branchFilter })
      .populate("productId", "name sku reorderLevel minStockLevel status")
      .populate("branchId", "name")
      .lean(),
    PurchaseOrder.countDocuments({
      ...tenant,
      deletedAt: null,
      status: { $in: ["requested", "approved", "ordered"] },
      ...branchFilter,
    }),
    PurchaseOrder.countDocuments({
      ...tenant,
      deletedAt: null,
      status: "in_transit",
      ...branchFilter,
    }),
    StockTransfer.countDocuments({
      ...tenant,
      deletedAt: null,
      status: { $in: ["requested", "approved", "dispatched"] },
    }),
    Supplier.countDocuments({ ...tenant, deletedAt: null, status: "active" }),
    PurchaseOrder.find({ ...tenant, deletedAt: null, ...branchFilter })
      .populate("supplierId", "name")
      .populate("branchId", "name")
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const enrichedLevels = stockLevels
    .filter((l) => {
      const p = l.productId as { status?: string } | null;
      return p && p.status !== "archived";
    })
    .map((l) => enrichStockAlert(l));

  const lowStock = enrichedLevels.filter((l) => l.needsRestock);
  const outOfStock = enrichedLevels.filter((l) => l.currentStock <= 0);

  const branchMap = new Map<
    string,
    { branchId: string; branchName: string; totalItems: number; totalQty: number; lowStockCount: number }
  >();

  for (const level of enrichedLevels) {
    const branchId = String(
      level.branchId && typeof level.branchId === "object" ? level.branchId._id : level.branchId
    );
    const branchName =
      level.branchId && typeof level.branchId === "object" ? level.branchId.name ?? "Branch" : "Branch";
    const existing = branchMap.get(branchId) ?? {
      branchId,
      branchName,
      totalItems: 0,
      totalQty: 0,
      lowStockCount: 0,
    };
    existing.totalItems += 1;
    existing.totalQty += level.currentStock;
    if (level.needsRestock) existing.lowStockCount += 1;
    branchMap.set(branchId, existing);
  }

  const branchSummary = Array.from(branchMap.values()).sort((a, b) =>
    a.branchName.localeCompare(b.branchName)
  );

  const activePipelineStatuses = new Set([
    "draft",
    "requested",
    "approved",
    "ordered",
    "in_transit",
    "partially_received",
    "received",
  ]);

  const purchaseByStatus: Record<string, number> = {};
  for (const order of purchaseOrders) {
    if (!activePipelineStatuses.has(order.status)) continue;
    purchaseByStatus[order.status] = (purchaseByStatus[order.status] ?? 0) + 1;
  }

  const recentPurchaseOrders = purchaseOrders
    .filter((o) => activePipelineStatuses.has(o.status))
    .slice(0, 5);

  return sendSuccess(res, {
    totalProducts,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    pendingPurchaseOrders: pendingPurchases,
    stockInTransit: inTransitPurchases,
    pendingTransfers,
    activeSuppliers,
    lowStock: lowStock.slice(0, 20),
    outOfStock: outOfStock.slice(0, 10),
    branchSummary,
    purchaseByStatus,
    recentPurchaseOrders,
  });
}

export async function inventoryReport(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const filter: Record<string, unknown> = { ...tenant };
  if (req.query.branchId) filter.branchId = req.query.branchId;

  const levels = await StockLevel.find(filter)
    .populate("productId", "name sku code category purchaseCost sellingPrice unitOfMeasure")
    .populate("branchId", "name code")
    .lean();

  return sendSuccess(res, levels);
}

export async function lowStockReport(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const levels = await StockLevel.find(tenant)
    .populate("productId", "name sku code reorderLevel minStockLevel")
    .populate("branchId", "name code")
    .lean();

  const report = levels.filter((l) => {
    const p = l.productId as { reorderLevel?: number; minStockLevel?: number } | null;
    const reorder = l.reorderLevel ?? p?.reorderLevel ?? p?.minStockLevel ?? 0;
    return reorder > 0 && l.currentStock <= reorder;
  });

  return sendSuccess(res, report);
}

export async function branchStockReport(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const branchId = req.query.branchId;
  if (!branchId) throw new AppError("BAD_REQUEST", "branchId is required", 400);

  const levels = await StockLevel.find({ ...tenant, branchId })
    .populate("productId", "name sku code unitOfMeasure purchaseCost")
    .lean();

  return sendSuccess(res, levels);
}

export async function supplierReport(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const suppliers = await Supplier.find({ ...tenant, deletedAt: null })
    .populate("productIds", "name sku")
    .lean();

  const withStats = await Promise.all(
    suppliers.map(async (s) => {
      const orders = await PurchaseOrder.find({ supplierId: s._id, deletedAt: null }).lean();
      const received = orders.filter((o) => ["received", "closed"].includes(o.status)).length;
      return {
        ...s,
        totalOrders: orders.length,
        receivedOrders: received,
        pendingOrders: orders.length - received,
      };
    })
  );

  return sendSuccess(res, withStats);
}

export async function purchaseReport(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const filter: Record<string, unknown> = { ...tenant, deletedAt: null };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.fromDate || req.query.toDate) {
    filter.createdAt = {};
    if (req.query.fromDate) (filter.createdAt as Record<string, Date>).$gte = new Date(String(req.query.fromDate));
    if (req.query.toDate) {
      const to = new Date(String(req.query.toDate));
      to.setHours(23, 59, 59, 999);
      (filter.createdAt as Record<string, Date>).$lte = to;
    }
  }

  const orders = await PurchaseOrder.find(filter)
    .populate("supplierId", "name")
    .populate("branchId", "name")
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, orders);
}

export async function transferReport(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const filter: Record<string, unknown> = { ...tenant, deletedAt: null };
  if (req.query.status) filter.status = req.query.status;

  const transfers = await StockTransfer.find(filter)
    .populate("fromBranchId", "name")
    .populate("toBranchId", "name")
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, transfers);
}
