import type { Request, Response } from "express";
import { Supplier } from "../models/Supplier.model";
import { PurchaseOrder } from "../models/PurchaseOrder.model";
import { buildTenantFilter, resolveRequestCompanyId } from "../services/permission.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

export async function createSupplier(req: Request, res: Response) {
  const companyId = await resolveRequestCompanyId(
    req.user!,
    req.body.companyId,
    req.body.branchId
  );

  const supplier = await Supplier.create({
    ...req.body,
    companyId,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });
  return sendSuccess(res, supplier, 201);
}

export async function listSuppliers(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(String(req.query.search), "i") },
      { contactPerson: new RegExp(String(req.query.search), "i") },
      { email: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Supplier.find(filter)
      .populate("productIds", "name sku")
      .sort(buildSortQuery(sortBy ?? "name", sortOrder))
      .skip(skip)
      .limit(limit)
      .lean(),
    Supplier.countDocuments(filter),
  ]);

  const withStats = await Promise.all(
    items.map(async (s) => {
      const orders = await PurchaseOrder.find({ supplierId: s._id, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean();
      const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      return {
        ...s,
        totalOrders: orders.length,
        totalSpent,
        lastOrderAt: orders[0]?.createdAt ?? null,
      };
    })
  );

  return sendSuccess(res, withStats, 200, buildMeta(page, limit, total));
}

export async function getSupplier(req: Request, res: Response) {
  const supplier = await Supplier.findOne({ _id: req.params.id, deletedAt: null })
    .populate("productIds", "name sku code status")
    .lean();
  if (!supplier) throw new AppError("NOT_FOUND", "Supplier not found", 404);

  const purchaseOrders = await PurchaseOrder.find({
    supplierId: supplier._id,
    deletedAt: null,
  })
    .populate("branchId", "name code")
    .populate("items.productId", "name sku code unitOfMeasure")
    .sort({ createdAt: -1 })
    .lean();

  const totalSpent = purchaseOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  return sendSuccess(res, {
    ...supplier,
    purchaseOrders,
    totalOrders: purchaseOrders.length,
    totalSpent,
    lastOrderAt: purchaseOrders[0]?.createdAt ?? null,
  });
}

export async function updateSupplier(req: Request, res: Response) {
  const supplier = await Supplier.findOne({ _id: req.params.id, deletedAt: null });
  if (!supplier) throw new AppError("NOT_FOUND", "Supplier not found", 404);

  Object.assign(supplier, req.body, { updatedBy: req.user!._id });
  await supplier.save();
  return sendSuccess(res, supplier);
}

export async function deleteSupplier(req: Request, res: Response) {
  const supplier = await Supplier.findOne({ _id: req.params.id, deletedAt: null });
  if (!supplier) throw new AppError("NOT_FOUND", "Supplier not found", 404);

  supplier.status = "archived";
  supplier.deletedAt = new Date();
  supplier.updatedBy = req.user!._id;
  await supplier.save();
  return sendSuccess(res, { message: "Supplier archived" });
}
