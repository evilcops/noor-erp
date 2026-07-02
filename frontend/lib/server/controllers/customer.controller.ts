import type { Request, Response } from "express";
import { Customer } from "../models/Customer.model";
import { Sale } from "../models/Sale.model";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";
import { Branch } from "../models/Branch.model";
import {
  assertBranchAccess,
  assertCompanyAccess,
  buildTenantFilter,
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

async function generateSaleNumber(companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `SAL-${year}-`;
  const count = await Sale.countDocuments({
    companyId,
    saleNumber: new RegExp(`^${prefix}`),
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

async function findOrCreateCustomer(
  companyId: string,
  data: { phone: string; email?: string; name?: string },
  userId: string
) {
  const phone = data.phone.trim();
  let customer = await Customer.findOne({ companyId, phone, deletedAt: null });

  if (customer) {
    if (data.email && !customer.email) customer.email = data.email.trim();
    if (data.name && !customer.name) customer.name = data.name.trim();
    customer.updatedBy = userId as typeof customer.updatedBy;
    await customer.save();
    return customer;
  }

  return Customer.create({
    companyId,
    phone,
    email: data.email?.trim() || undefined,
    name: data.name?.trim() || undefined,
    createdBy: userId,
    updatedBy: userId,
  });
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

export async function getCustomer(req: Request, res: Response) {
  const customer = await Customer.findOne({ _id: req.params.id, deletedAt: null }).lean();
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

export async function recordSale(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);
  assertBranchAccess(req.user!, req.body.branchId, req.body.companyId);

  const product = await Product.findOne({ _id: req.body.productId, deletedAt: null });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  const stock = await StockLevel.findOne({
    companyId: req.body.companyId,
    branchId: req.body.branchId,
    productId: req.body.productId,
  });

  if (!stock || stock.currentStock < req.body.quantity) {
    throw new AppError("BAD_REQUEST", "Insufficient stock for this sale", 400);
  }

  const unitPrice = req.body.unitPrice ?? product.sellingPrice ?? 0;
  const totalAmount = unitPrice * req.body.quantity;

  let customer;
  if (req.body.customerId) {
    customer = await Customer.findOne({
      _id: req.body.customerId,
      companyId: req.body.companyId,
      deletedAt: null,
    });
    if (!customer) throw new AppError("NOT_FOUND", "Customer not found", 404);
  } else {
    customer = await findOrCreateCustomer(
      req.body.companyId,
      {
        phone: req.body.customerPhone,
        email: req.body.customerEmail,
        name: req.body.customerName,
      },
      String(req.user!._id)
    );
  }

  const saleNumber = await generateSaleNumber(req.body.companyId);
  const sale = await Sale.create({
    companyId: req.body.companyId,
    branchId: req.body.branchId,
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
    branchId: req.body.branchId,
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
    const branch = await Branch.findById(req.body.branchId).select("name");
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
    .populate("customerId", "name phone email")
    .populate("branchId", "name")
    .lean();

  return sendSuccess(res, populated, 201);
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
