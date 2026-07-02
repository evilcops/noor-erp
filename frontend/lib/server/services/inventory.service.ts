import mongoose from "mongoose";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";
import type { StockMovementType } from "../models/StockMovement.model";
import { StockMovement } from "../models/StockMovement.model";
import type mongoose from "mongoose";

export async function generateSku(companyId: mongoose.Types.ObjectId | string): Promise<string> {
  const count = await Product.countDocuments({ companyId, deletedAt: null });
  const seq = String(count + 1).padStart(5, "0");
  return `SKU-${seq}`;
}

export async function generateProductCode(
  companyId: mongoose.Types.ObjectId | string
): Promise<string> {
  const count = await Product.countDocuments({ companyId, deletedAt: null });
  return `PRD-${String(count + 1).padStart(5, "0")}`;
}

export function generateBarcode(sku: string): string {
  const numeric = sku.replace(/\D/g, "").padStart(12, "0").slice(-12);
  return numeric || String(Date.now()).slice(-12);
}

export function buildQrCodeData(productId: string, sku: string): string {
  return JSON.stringify({ type: "noor_product", id: productId, sku });
}

export async function generatePoNumber(
  companyId: mongoose.Types.ObjectId | string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const count = await import("../models/PurchaseOrder.model").then((m) =>
    m.PurchaseOrder.countDocuments({ companyId, poNumber: new RegExp(`^${prefix}`) })
  );
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function generateTransferNumber(
  companyId: mongoose.Types.ObjectId | string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRF-${year}-`;
  const count = await import("../models/StockTransfer.model").then((m) =>
    m.StockTransfer.countDocuments({ companyId, transferNumber: new RegExp(`^${prefix}`) })
  );
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function generateGrnNumber(
  companyId: mongoose.Types.ObjectId | string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GRN-${year}-`;
  const count = await import("../models/GoodsReceivedNote.model").then((m) =>
    m.GoodsReceivedNote.countDocuments({ companyId, grnNumber: new RegExp(`^${prefix}`) })
  );
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

interface StockUpdateInput {
  companyId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
  type: StockMovementType;
  reason?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string;
  field?: "currentStock" | "damagedStock" | "returnedStock";
}

export async function updateStockLevel(input: StockUpdateInput) {
  const field = input.field ?? "currentStock";
  const delta = input.quantity;

  let stock = await StockLevel.findOne({
    companyId: input.companyId,
    branchId: input.branchId,
    productId: input.productId,
  });

  if (!stock) {
    stock = await StockLevel.create({
      companyId: input.companyId,
      branchId: input.branchId,
      productId: input.productId,
      openingStock: 0,
      currentStock: 0,
      damagedStock: 0,
      returnedStock: 0,
      createdBy: input.userId,
    });
  }

  const previousQty = stock[field] as number;
  const newQty = previousQty + delta;
  if (newQty < 0) {
    throw new Error(`Insufficient stock for product ${input.productId}`);
  }

  stock[field] = newQty;
  stock.updatedBy = input.userId as mongoose.Types.ObjectId;
  await stock.save();

  await StockMovement.create({
    companyId: input.companyId,
    branchId: input.branchId,
    productId: input.productId,
    type: input.type,
    quantity: delta,
    previousQty,
    newQty,
    reason: input.reason,
    notes: input.notes,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    createdBy: input.userId,
  });

  return stock;
}

export async function getOrCreateStockLevel(
  companyId: mongoose.Types.ObjectId | string,
  branchId: mongoose.Types.ObjectId | string,
  productId: mongoose.Types.ObjectId | string,
  userId?: mongoose.Types.ObjectId | string
) {
  let stock = await StockLevel.findOne({ companyId, branchId, productId });
  if (!stock) {
    stock = await StockLevel.create({
      companyId,
      branchId,
      productId,
      openingStock: 0,
      currentStock: 0,
      damagedStock: 0,
      returnedStock: 0,
      createdBy: userId,
    });
  }
  return stock;
}

type ReorderProductRef = { reorderLevel?: number; minStockLevel?: number; status?: string } | null;

export function getEffectiveReorderLevel(
  stockLevel: { reorderLevel?: number },
  product?: ReorderProductRef
): number {
  return stockLevel.reorderLevel ?? product?.reorderLevel ?? product?.minStockLevel ?? 0;
}

export function isLowStockLevel(
  currentStock: number,
  stockLevel: { reorderLevel?: number },
  product?: ReorderProductRef
): boolean {
  const reorder = getEffectiveReorderLevel(stockLevel, product);
  return reorder > 0 && currentStock <= reorder;
}

export function suggestedRestockQty(
  currentStock: number,
  stockLevel: { reorderLevel?: number },
  product?: ReorderProductRef
): number {
  const reorder = getEffectiveReorderLevel(stockLevel, product);
  if (reorder <= 0) return Math.max(1, 1 - currentStock);
  const targetQty = reorder * 2;
  return Math.max(targetQty - currentStock, 1);
}

export function enrichStockAlert<T extends { currentStock: number; reorderLevel?: number; productId?: unknown }>(
  level: T
) {
  const product =
    level.productId && typeof level.productId === "object"
      ? (level.productId as ReorderProductRef)
      : null;
  const effectiveReorderLevel = getEffectiveReorderLevel(level, product);
  return {
    ...level,
    effectiveReorderLevel,
    suggestedRestockQty: suggestedRestockQty(level.currentStock, level, product),
    needsRestock: isLowStockLevel(level.currentStock, level, product),
  };
}

export async function syncProductStockStatus(productId: mongoose.Types.ObjectId | string) {
  const total = await StockLevel.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(String(productId)) } },
    { $group: { _id: null, total: { $sum: "$currentStock" } } },
  ]);
  const qty = total[0]?.total ?? 0;
  const product = await Product.findById(productId);
  if (!product || product.status === "archived" || product.status === "discontinued") return;

  if (qty <= 0 && product.status === "active") {
    product.status = "out_of_stock";
    await product.save();
  } else if (qty > 0 && product.status === "out_of_stock") {
    product.status = "active";
    await product.save();
  }
}
