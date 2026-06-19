import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { BranchDocument } from "../models/BranchDocument.model";
import { Branch } from "../models/Branch.model";
import { buildTenantFilter } from "../services/permission.service";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const ALERT_DAYS = [45, 30, 15];

function computeStatus(expiryDate?: Date): "valid" | "expired" | "expiring_soon" {
  if (!expiryDate) return "valid";
  const now = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= ALERT_DAYS[0]) return "expiring_soon";
  return "valid";
}

export async function listBranchDocuments(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {
    ...buildTenantFilter(req.user!),
    deletedAt: null,
  };
  if (req.query.branchId) filter.branchId = req.query.branchId;

  const [items, total] = await Promise.all([
    BranchDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("branchId", "name code")
      .lean(),
    BranchDocument.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getBranchDocument(req: Request, res: Response) {
  const doc = await BranchDocument.findOne({
    _id: req.params.id,
    deletedAt: null,
  }).populate("branchId", "name code");
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);
  return sendSuccess(res, doc);
}

export async function createBranchDocument(req: Request, res: Response) {
  const { branchId, type, customTypeName, issuanceDate, expiryDate, notes } = req.body;

  if (!branchId) throw new AppError("VALIDATION_ERROR", "branchId is required", 400);
  if (type === "custom" && !customTypeName?.trim()) {
    throw new AppError("VALIDATION_ERROR", "customTypeName is required for custom documents", 400);
  }

  const branch = await Branch.findById(branchId);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);

  const expiry = expiryDate ? new Date(expiryDate) : undefined;

  const doc = await BranchDocument.create({
    companyId: branch.companyId,
    branchId,
    type,
    customTypeName: type === "custom" ? customTypeName : undefined,
    issuanceDate: issuanceDate ? new Date(issuanceDate) : undefined,
    expiryDate: expiry,
    status: computeStatus(expiry),
    notes,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  return sendSuccess(res, doc, 201);
}

export async function updateBranchDocument(req: Request, res: Response) {
  const doc = await BranchDocument.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);

  const { type, customTypeName, issuanceDate, expiryDate, notes } = req.body;

  if (type !== undefined) doc.type = type;
  if (customTypeName !== undefined) doc.customTypeName = customTypeName;
  if (issuanceDate !== undefined) doc.issuanceDate = issuanceDate ? new Date(issuanceDate) : undefined;
  if (expiryDate !== undefined) doc.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
  if (notes !== undefined) doc.notes = notes;

  doc.status = computeStatus(doc.expiryDate);
  doc.updatedBy = req.user!._id;
  await doc.save();

  return sendSuccess(res, doc);
}

export async function deleteBranchDocument(req: Request, res: Response) {
  const doc = await BranchDocument.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);

  doc.deletedAt = new Date();
  doc.updatedBy = req.user!._id;
  await doc.save();

  return sendSuccess(res, { message: "Document deleted" });
}

export async function uploadBranchDocumentFile(req: Request, res: Response) {
  const doc = await BranchDocument.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new AppError("NOT_FOUND", "Document not found", 404);
  if (!req.file) throw new AppError("VALIDATION_ERROR", "File required", 400);

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(req.file.originalname) || ".pdf";
  const filename = `branch-${Date.now()}-${doc._id}${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);

  doc.fileUrl = `/api/uploads/${filename}`;
  doc.updatedBy = req.user!._id;
  await doc.save();

  return sendSuccess(res, doc);
}

export async function getExpiringBranchDocuments(req: Request, res: Response) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 45 * 86_400_000);

  const filter: Record<string, unknown> = {
    ...buildTenantFilter(req.user!),
    deletedAt: null,
    expiryDate: { $lte: horizon },
  };

  const docs = await BranchDocument.find(filter)
    .populate("branchId", "name code")
    .lean();

  const alerts = docs
    .map((doc) => {
      if (!doc.expiryDate) return null;
      const daysRemaining = Math.ceil(
        (new Date(doc.expiryDate).getTime() - now.getTime()) / 86_400_000
      );
      let alertLevel: "critical" | "warning" | "notice" = "notice";
      if (daysRemaining <= 15) alertLevel = "critical";
      else if (daysRemaining <= 30) alertLevel = "warning";

      const branch = doc.branchId as unknown as { _id?: unknown; name?: string; code?: string } | null;
      const branchId =
        branch && typeof branch === "object" && branch._id != null
          ? String(branch._id)
          : String(doc.branchId);

      return {
        documentId: String(doc._id),
        branchId,
        branchName: branch?.name ?? "Unknown branch",
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
