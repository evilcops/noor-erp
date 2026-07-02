import type { Request, Response } from "express";
import { StockTransfer } from "../models/StockTransfer.model";
import { Branch } from "../models/Branch.model";
import { StockLevel } from "../models/StockLevel.model";
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
  generateTransferNumber,
  syncProductStockStatus,
  updateStockLevel,
} from "../services/inventory.service";
import { notifyStockTransferRequest } from "../services/inventory-notification.service";

export async function createTransfer(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);
  assertBranchAccess(req.user!, req.body.fromBranchId, req.body.companyId);
  assertBranchAccess(req.user!, req.body.toBranchId, req.body.companyId);

  if (req.body.fromBranchId === req.body.toBranchId) {
    throw new AppError("BAD_REQUEST", "Source and destination branches must differ", 400);
  }

  const transferNumber = await generateTransferNumber(req.body.companyId);
  const transfer = await StockTransfer.create({
    ...req.body,
    transferNumber,
    status: "requested",
    requestedBy: req.user!._id,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  const [fromBranch, toBranch] = await Promise.all([
    Branch.findById(req.body.fromBranchId).select("name"),
    Branch.findById(req.body.toBranchId).select("name"),
  ]);

  await notifyStockTransferRequest(
    req.body.companyId,
    transferNumber,
    fromBranch?.name ?? "Branch",
    toBranch?.name ?? "Branch"
  );

  return sendSuccess(res, transfer, 201);
}

export async function listTransfers(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.fromBranchId) filter.fromBranchId = req.query.fromBranchId;
  if (req.query.toBranchId) filter.toBranchId = req.query.toBranchId;
  if (req.query.search) filter.transferNumber = new RegExp(String(req.query.search), "i");

  const [items, total] = await Promise.all([
    StockTransfer.find(filter)
      .populate("fromBranchId", "name code")
      .populate("toBranchId", "name code")
      .populate("items.productId", "name sku unitOfMeasure")
      .sort(buildSortQuery(sortBy ?? "createdAt", sortOrder ?? "desc"))
      .skip(skip)
      .limit(limit)
      .lean(),
    StockTransfer.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getTransfer(req: Request, res: Response) {
  const transfer = await StockTransfer.findOne({ _id: req.params.id, deletedAt: null })
    .populate("fromBranchId", "name code")
    .populate("toBranchId", "name code")
    .populate("items.productId", "name sku code unitOfMeasure")
    .populate("requestedBy", "firstName lastName")
    .populate("approvedBy", "firstName lastName")
    .lean();
  if (!transfer) throw new AppError("NOT_FOUND", "Stock transfer not found", 404);
  return sendSuccess(res, transfer);
}

export async function approveTransfer(req: Request, res: Response) {
  const transfer = await StockTransfer.findOne({ _id: req.params.id, deletedAt: null });
  if (!transfer) throw new AppError("NOT_FOUND", "Stock transfer not found", 404);
  if (transfer.status !== "requested") throw new AppError("BAD_REQUEST", "Only requested transfers can be approved", 400);

  transfer.status = "approved";
  transfer.approvedBy = req.user!._id;
  transfer.updatedBy = req.user!._id;
  await transfer.save();
  return sendSuccess(res, transfer);
}

export async function rejectTransfer(req: Request, res: Response) {
  const transfer = await StockTransfer.findOne({ _id: req.params.id, deletedAt: null });
  if (!transfer) throw new AppError("NOT_FOUND", "Stock transfer not found", 404);
  if (transfer.status !== "requested") throw new AppError("BAD_REQUEST", "Only requested transfers can be rejected", 400);

  transfer.status = "rejected";
  transfer.updatedBy = req.user!._id;
  await transfer.save();
  return sendSuccess(res, transfer);
}

export async function dispatchTransfer(req: Request, res: Response) {
  const transfer = await StockTransfer.findOne({ _id: req.params.id, deletedAt: null });
  if (!transfer) throw new AppError("NOT_FOUND", "Stock transfer not found", 404);
  if (!["approved", "dispatched"].includes(transfer.status)) {
    throw new AppError("BAD_REQUEST", "Transfer must be approved before dispatch", 400);
  }

  const dispatched = req.body.items as { productId: string; quantityDispatched: number }[];

  for (const d of dispatched) {
    const item = transfer.items.find((i) => String(i.productId) === d.productId);
    if (!item) continue;

    const stock = await StockLevel.findOne({
      companyId: transfer.companyId,
      branchId: transfer.fromBranchId,
      productId: item.productId,
    });
    if (!stock || stock.currentStock < d.quantityDispatched) {
      throw new AppError("BAD_REQUEST", "Insufficient stock at sending branch", 400);
    }

    item.quantityDispatched = d.quantityDispatched;

    await updateStockLevel({
      companyId: transfer.companyId,
      branchId: transfer.fromBranchId,
      productId: item.productId,
      quantity: -d.quantityDispatched,
      type: "transfer_out",
      reason: `Dispatched via transfer ${transfer.transferNumber}`,
      referenceType: "StockTransfer",
      referenceId: transfer._id,
      userId: req.user!._id,
    });

    await syncProductStockStatus(item.productId);
  }

  transfer.status = "dispatched";
  transfer.dispatchedAt = new Date();
  transfer.updatedBy = req.user!._id;
  await transfer.save();
  return sendSuccess(res, transfer);
}

export async function receiveTransfer(req: Request, res: Response) {
  const transfer = await StockTransfer.findOne({ _id: req.params.id, deletedAt: null });
  if (!transfer) throw new AppError("NOT_FOUND", "Stock transfer not found", 404);
  if (transfer.status !== "dispatched") {
    throw new AppError("BAD_REQUEST", "Transfer must be dispatched before receiving", 400);
  }

  const received = req.body.items as { productId: string; quantityReceived: number }[];

  for (const r of received) {
    const item = transfer.items.find((i) => String(i.productId) === r.productId);
    if (!item) continue;

    item.quantityReceived = r.quantityReceived;

    await updateStockLevel({
      companyId: transfer.companyId,
      branchId: transfer.toBranchId,
      productId: item.productId,
      quantity: r.quantityReceived,
      type: "transfer_in",
      reason: `Received via transfer ${transfer.transferNumber}`,
      referenceType: "StockTransfer",
      referenceId: transfer._id,
      userId: req.user!._id,
    });

    await syncProductStockStatus(item.productId);
  }

  transfer.status = "received";
  transfer.receivedAt = new Date();
  transfer.updatedBy = req.user!._id;
  await transfer.save();
  return sendSuccess(res, transfer);
}

export async function cancelTransfer(req: Request, res: Response) {
  const transfer = await StockTransfer.findOne({ _id: req.params.id, deletedAt: null });
  if (!transfer) throw new AppError("NOT_FOUND", "Stock transfer not found", 404);
  if (["dispatched", "received"].includes(transfer.status)) {
    throw new AppError("BAD_REQUEST", "Cannot cancel dispatched or received transfer", 400);
  }

  transfer.status = "cancelled";
  transfer.updatedBy = req.user!._id;
  await transfer.save();
  return sendSuccess(res, transfer);
}
