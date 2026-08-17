import type { Request, Response } from "express";
import { RefusedItem } from "../models/RefusedItem.model";
import { buildTenantFilter } from "../services/permission.service";
import { discardRefusedItem, restockRefusedItem } from "../services/refused-item.service";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

export async function listRefusedItems(req: Request, res: Response) {
  if (!req.user) throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  const tenant = buildTenantFilter(req.user);
  const { page, limit, skip } = parsePagination(req.query);

  const filter: Record<string, unknown> = { ...tenant, deletedAt: null };
  if (req.query.branchId) filter.branchId = String(req.query.branchId);
  if (req.query.status) filter.status = String(req.query.status);
  else filter.status = { $in: ["at_warehouse", "with_rider"] };

  if (req.query.search) {
    const q = String(req.query.search);
    filter.$or = [
      { deliveryNumber: new RegExp(q, "i") },
      { saleNumber: new RegExp(q, "i") },
    ];
  }

  const [items, total] = await Promise.all([
    RefusedItem.find(filter)
      .populate("productId", "name sku images unitOfMeasure")
      .populate("branchId", "name code")
      .populate({
        path: "riderId",
        select: "riderCode employeeId",
        populate: { path: "employeeId", select: "firstName lastName" },
      })
      .sort({ returnedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RefusedItem.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function restockRefusedItemHandler(req: Request, res: Response) {
  if (!req.user) throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;
  const item = await restockRefusedItem(String(req.params.id), String(req.user._id), { notes });
  const populated = await RefusedItem.findById(item._id)
    .populate("productId", "name sku")
    .populate("branchId", "name code")
    .lean();
  return sendSuccess(res, populated);
}

export async function discardRefusedItemHandler(req: Request, res: Response) {
  if (!req.user) throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;
  const item = await discardRefusedItem(String(req.params.id), String(req.user._id), { notes });
  return sendSuccess(res, item);
}
