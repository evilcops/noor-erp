import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";
import { Supplier } from "../models/Supplier.model";
import {
  assertBranchAccess,
  assertCompanyAccess,
  buildTenantFilter,
  resolveRequestCompanyId,
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
  buildQrCodeData,
  generateBarcode,
  generateProductCode,
  generateSku,
  getOrCreateStockLevel,
  syncProductStockStatus,
  updateStockLevel,
} from "../services/inventory.service";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_PRODUCT_IMAGES = 5;
const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

async function persistProductImage(
  buffer: Buffer,
  originalname: string,
  productId: string
): Promise<string> {
  const ext = path.extname(originalname).toLowerCase() || ".jpg";
  if (!ALLOWED_IMAGE_EXT.has(ext)) {
    throw new AppError("VALIDATION_ERROR", "Only JPG, PNG, WEBP, or GIF images are allowed", 400);
  }

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = `${Date.now()}-product-${productId}${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, safeName), buffer);
  return `/api/uploads/${safeName}`;
}

export async function uploadProductImage(req: Request, res: Response) {
  const product = await Product.findOne({ _id: req.params.id, deletedAt: null });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  if (!req.file) throw new AppError("VALIDATION_ERROR", "Image file required", 400);

  const images = product.images ?? [];
  if (images.length >= MAX_PRODUCT_IMAGES) {
    throw new AppError("BAD_REQUEST", `Maximum ${MAX_PRODUCT_IMAGES} images per product`, 400);
  }

  const fileUrl = await persistProductImage(
    req.file.buffer,
    req.file.originalname,
    String(product._id)
  );

  product.images = [...images, fileUrl];
  product.updatedBy = req.user!._id;
  await product.save();

  return sendSuccess(res, product);
}

export async function deleteProductImage(req: Request, res: Response) {
  const product = await Product.findOne({ _id: req.params.id, deletedAt: null });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  const index = Number(req.params.imageIndex);
  if (!Number.isInteger(index) || index < 0 || index >= (product.images?.length ?? 0)) {
    throw new AppError("BAD_REQUEST", "Invalid image index", 400);
  }

  product.images = product.images.filter((_, i) => i !== index);
  product.updatedBy = req.user!._id;
  await product.save();

  return sendSuccess(res, product);
}

export async function createProduct(req: Request, res: Response) {
  const { companyId } = await resolveRequestTenant(req.user!, {
    companyId: req.body.companyId,
    branchId: req.body.branchId ?? req.body.initialStock?.branchId,
  });

  const sku = req.body.sku || (await generateSku(companyId));
  const code = req.body.code || (await generateProductCode(companyId));
  const barcode = req.body.barcode || generateBarcode(sku);

  const existing = await Product.findOne({
    companyId,
    sku,
    deletedAt: null,
  });
  if (existing) throw new AppError("CONFLICT", "SKU already exists", 409);

  const product = await Product.create({
    ...req.body,
    companyId,
    sku,
    code,
    barcode,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  product.qrCodeData = buildQrCodeData(String(product._id), product.sku);
  await product.save();

  if (req.body.initialStock?.branchId) {
    assertBranchAccess(req.user!, req.body.initialStock.branchId, companyId);
    if (req.body.initialStock.quantity > 0) {
      await updateStockLevel({
        companyId,
        branchId: req.body.initialStock.branchId,
        productId: product._id,
        quantity: req.body.initialStock.quantity,
        type: "manual_correction",
        reason: "Initial stock on product creation",
        userId: req.user!._id,
      });
    } else {
      await getOrCreateStockLevel(
        req.body.companyId,
        req.body.initialStock.branchId,
        product._id,
        req.user!._id
      );
    }
  }

  return sendSuccess(res, product, 201);
}

export async function listProducts(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.supplierId) filter.supplierId = req.query.supplierId;
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(String(req.query.search), "i") },
      { sku: new RegExp(String(req.query.search), "i") },
      { code: new RegExp(String(req.query.search), "i") },
      { barcode: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("supplierId", "name")
      .sort(buildSortQuery(sortBy ?? "name", sortOrder))
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getProduct(req: Request, res: Response) {
  const product = await Product.findOne({ _id: req.params.id, deletedAt: null })
    .populate("supplierId", "name contactPerson phone email")
    .lean();
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  const stockLevels = await StockLevel.find({ productId: product._id })
    .populate("branchId", "name code")
    .lean();

  return sendSuccess(res, { ...product, stockLevels });
}

export async function updateProduct(req: Request, res: Response) {
  const product = await Product.findOne({ _id: req.params.id, deletedAt: null });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  if (req.body.sku && req.body.sku !== product.sku) {
    const dup = await Product.findOne({
      companyId: product.companyId,
      sku: req.body.sku,
      deletedAt: null,
      _id: { $ne: product._id },
    });
    if (dup) throw new AppError("CONFLICT", "SKU already exists", 409);
  }

  Object.assign(product, req.body, { updatedBy: req.user!._id });
  if (!product.qrCodeData) {
    product.qrCodeData = buildQrCodeData(String(product._id), product.sku);
  }
  await product.save();
  return sendSuccess(res, product);
}

export async function deleteProduct(req: Request, res: Response) {
  const product = await Product.findOne({ _id: req.params.id, deletedAt: null });
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  product.status = "archived";
  product.deletedAt = new Date();
  product.updatedBy = req.user!._id;
  await product.save();
  return sendSuccess(res, { message: "Product archived" });
}

export async function getProductBySku(req: Request, res: Response) {
  const filter: Record<string, unknown> = {
    ...buildTenantFilter(req.user!),
    deletedAt: null,
    $or: [{ sku: req.params.code }, { barcode: req.params.code }, { code: req.params.code }],
  };
  const product = await Product.findOne(filter).populate("supplierId", "name").lean();
  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);
  return sendSuccess(res, product);
}

export async function listCategories(req: Request, res: Response) {
  const filter = { ...buildTenantFilter(req.user!), deletedAt: null };
  const categories = await Product.distinct("category", filter);
  const subCategories = await Product.distinct("subCategory", filter);
  return sendSuccess(res, {
    categories: categories.filter(Boolean),
    subCategories: subCategories.filter(Boolean),
  });
}
