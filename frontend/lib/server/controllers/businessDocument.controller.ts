import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { BusinessDocument } from "../models/BusinessDocument.model";
import { buildTenantFilter } from "../services/permission.service";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

// 45 / 30 / 15 day thresholds for all business docs
const ALERT_DAYS = [45, 30, 15];

function computeStatus(expiryDate?: Date): "valid" | "expired" | "expiring_soon" {
  if (!expiryDate) return "valid";
  const now = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= ALERT_DAYS[0]) return "expiring_soon";
  return "valid";
}

export async function listBusinessDocuments(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const companyId = req.user!.companyId ?? req.query.companyId;
  const filter: Record<string, unknown> = {
    ...(companyId ? { companyId } : {}),
    deletedAt: null,
  };

  const [items, total] = await Promise.all([
    BusinessDocument.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    BusinessDocument.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getBusinessDocument(req: Request, res: Response) {
  const filter: Record<string, unknown> = { _id: req.params.id, deletedAt: null };
  if (req.user!.companyId) filter.companyId = req.user!.companyId;
  const doc = await BusinessDocument.findOne(filter);
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);
  return sendSuccess(res, doc);
}

export async function createBusinessDocument(req: Request, res: Response) {
  const { type, customTypeName, startDate, expiryDate, notes, companyId: bodyCompanyId } = req.body;

  // Use the user's own companyId first; fall back to body for super-admins managing multiple companies
  const companyId = req.user!.companyId ?? bodyCompanyId;
  if (!companyId) {
    throw new AppError("VALIDATION_ERROR", "companyId is required — assign a company to this user account", 400);
  }

  if (type === "custom" && !customTypeName?.trim()) {
    throw new AppError("VALIDATION_ERROR", "customTypeName is required for custom documents", 400);
  }

  const expiry = expiryDate ? new Date(expiryDate) : undefined;

  const doc = await BusinessDocument.create({
    companyId,
    type,
    customTypeName: type === "custom" ? customTypeName : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    expiryDate: expiry,
    status: computeStatus(expiry),
    notes,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  return sendSuccess(res, doc, 201);
}

export async function updateBusinessDocument(req: Request, res: Response) {
  const filter: Record<string, unknown> = { _id: req.params.id, deletedAt: null };
  if (req.user!.companyId) filter.companyId = req.user!.companyId;
  const doc = await BusinessDocument.findOne(filter);
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);

  const { type, customTypeName, startDate, expiryDate, notes } = req.body;

  if (type !== undefined) doc.type = type;
  if (customTypeName !== undefined) doc.customTypeName = customTypeName;
  if (startDate !== undefined) doc.startDate = startDate ? new Date(startDate) : undefined;
  if (expiryDate !== undefined) {
    doc.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
  }
  if (notes !== undefined) doc.notes = notes;

  doc.status = computeStatus(doc.expiryDate);
  doc.updatedBy = req.user!._id;
  await doc.save();

  return sendSuccess(res, doc);
}

export async function deleteBusinessDocument(req: Request, res: Response) {
  const filter: Record<string, unknown> = { _id: req.params.id, deletedAt: null };
  if (req.user!.companyId) filter.companyId = req.user!.companyId;
  const doc = await BusinessDocument.findOne(filter);
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);

  doc.deletedAt = new Date();
  doc.updatedBy = req.user!._id;
  await doc.save();

  return sendSuccess(res, { message: "Document deleted" });
}

export async function uploadBusinessDocumentFile(req: Request, res: Response) {
  const filter: Record<string, unknown> = { _id: req.params.id, deletedAt: null };
  if (req.user!.companyId) filter.companyId = req.user!.companyId;
  const doc = await BusinessDocument.findOne(filter);
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);
  if (!req.file) throw new AppError("VALIDATION_ERROR", "File required", 400);

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(req.file.originalname) || ".pdf";
  const filename = `biz-${Date.now()}-${doc._id}${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);

  doc.fileUrl = `/api/uploads/${filename}`;
  doc.updatedBy = req.user!._id;
  await doc.save();

  return sendSuccess(res, doc);
}

export async function getExpiringBusinessDocuments(req: Request, res: Response) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 45 * 86_400_000);
  const companyId = req.user!.companyId;

  const docs = await BusinessDocument.find({
    ...(companyId ? { companyId } : {}),
    deletedAt: null,
    expiryDate: { $lte: horizon },
  }).lean();

  const alerts = docs
    .map((doc) => {
      if (!doc.expiryDate) return null;
      const daysRemaining = Math.ceil(
        (new Date(doc.expiryDate).getTime() - now.getTime()) / 86_400_000
      );
      let alertLevel: "critical" | "warning" | "notice" = "notice";
      if (daysRemaining <= 15) alertLevel = "critical";
      else if (daysRemaining <= 30) alertLevel = "warning";

      return {
        documentId: String(doc._id),
        companyId: String(doc.companyId),
        type: doc.type,
        customTypeName: doc.customTypeName,
        expiryDate: doc.expiryDate.toISOString(),
        daysRemaining,
        alertLevel,
      };
    })
    .filter(Boolean);

  return sendSuccess(res, alerts);
}
