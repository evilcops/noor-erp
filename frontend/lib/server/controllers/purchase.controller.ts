import type { Request, Response } from "express";
import { PurchaseOrder } from "../models/PurchaseOrder.model";
import { GoodsReceivedNote } from "../models/GoodsReceivedNote.model";
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
  generateGrnNumber,
  generatePoNumber,
  syncProductStockStatus,
  updateStockLevel,
} from "../services/inventory.service";
import {
  notifyPurchaseApproval,
  notifyStockReceived,
} from "../services/inventory-notification.service";

function calcTotal(items: { quantityOrdered: number; unitCost: number }[]) {
  return items.reduce((sum, i) => sum + i.quantityOrdered * i.unitCost, 0);
}

export async function createPurchase(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);
  assertBranchAccess(req.user!, req.body.branchId, req.body.companyId);

  const poNumber = await generatePoNumber(req.body.companyId);
  const totalAmount = calcTotal(req.body.items);

  const po = await PurchaseOrder.create({
    ...req.body,
    poNumber,
    totalAmount,
    status: "draft",
    requestedBy: req.user!._id,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  return sendSuccess(res, po, 201);
}

export async function listPurchases(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.supplierId) filter.supplierId = req.query.supplierId;
  if (req.query.search) {
    filter.poNumber = new RegExp(String(req.query.search), "i");
  }

  const [items, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .populate("supplierId", "name")
      .populate("branchId", "name code")
      .populate("items.productId", "name sku unitOfMeasure")
      .sort(buildSortQuery(sortBy ?? "createdAt", sortOrder ?? "desc"))
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseOrder.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getPurchase(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null })
    .populate("supplierId", "name contactPerson phone email")
    .populate("branchId", "name code")
    .populate("items.productId", "name sku code unitOfMeasure")
    .populate("requestedBy", "firstName lastName")
    .populate("approvedBy", "firstName lastName")
    .lean();
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);

  const grns = await GoodsReceivedNote.find({ purchaseOrderId: po._id })
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, { ...po, grns });
}

export async function updatePurchase(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null });
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);

  if (!["draft", "requested"].includes(po.status)) {
    throw new AppError("BAD_REQUEST", "Cannot edit purchase order in current status", 400);
  }

  Object.assign(po, req.body, { updatedBy: req.user!._id });
  if (req.body.items) po.totalAmount = calcTotal(req.body.items);
  await po.save();
  return sendSuccess(res, po);
}

export async function submitPurchase(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null });
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);
  if (po.status !== "draft") throw new AppError("BAD_REQUEST", "Only draft orders can be submitted", 400);

  po.status = "requested";
  po.updatedBy = req.user!._id;
  await po.save();

  await notifyPurchaseApproval(po.companyId, po.poNumber);
  return sendSuccess(res, po);
}

export async function approvePurchase(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null });
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);
  if (po.status !== "requested") throw new AppError("BAD_REQUEST", "Only requested orders can be approved", 400);

  po.status = "approved";
  po.approvedBy = req.user!._id;
  po.updatedBy = req.user!._id;
  await po.save();
  return sendSuccess(res, po);
}

export async function orderPurchase(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null });
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);
  if (!["approved", "ordered"].includes(po.status)) {
    throw new AppError("BAD_REQUEST", "Purchase must be approved before ordering", 400);
  }

  po.status = "ordered";
  po.orderedAt = new Date();
  po.updatedBy = req.user!._id;
  await po.save();
  return sendSuccess(res, po);
}

export async function markInTransit(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null });
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);
  if (!["ordered", "in_transit"].includes(po.status)) {
    throw new AppError("BAD_REQUEST", "Invalid status transition", 400);
  }

  po.status = "in_transit";
  po.updatedBy = req.user!._id;
  await po.save();
  return sendSuccess(res, po);
}

export async function receivePurchase(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null });
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);
  if (!["ordered", "in_transit", "partially_received"].includes(po.status)) {
    throw new AppError("BAD_REQUEST", "Cannot receive goods for this purchase order", 400);
  }

  const receivedItems = req.body.items as { productId: string; quantityReceived: number }[];
  let anyReceived = false;

  for (const received of receivedItems) {
    const item = po.items.find((i) => String(i.productId) === received.productId);
    if (!item) continue;

    const remaining = item.quantityOrdered - item.quantityReceived;
    const qty = Math.min(received.quantityReceived, remaining);
    if (qty <= 0) continue;

    item.quantityReceived += qty;
    anyReceived = true;

    await updateStockLevel({
      companyId: po.companyId,
      branchId: po.branchId,
      productId: item.productId,
      quantity: qty,
      type: "purchase_received",
      reason: `Goods received for PO ${po.poNumber}`,
      referenceType: "PurchaseOrder",
      referenceId: po._id,
      userId: req.user!._id,
    });

    await syncProductStockStatus(item.productId);
  }

  if (!anyReceived) throw new AppError("BAD_REQUEST", "No valid quantities to receive", 400);

  const allReceived = po.items.every((i) => i.quantityReceived >= i.quantityOrdered);
  po.status = allReceived ? "received" : "partially_received";
  if (allReceived) po.receivedAt = new Date();
  po.updatedBy = req.user!._id;
  await po.save();

  const grnNumber = await generateGrnNumber(po.companyId);
  const grn = await GoodsReceivedNote.create({
    companyId: po.companyId,
    branchId: po.branchId,
    purchaseOrderId: po._id,
    grnNumber,
    items: receivedItems
      .map((r) => {
        const item = po.items.find((i) => String(i.productId) === r.productId);
        if (!item) return null;
        return {
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          quantityReceived: r.quantityReceived,
          unitCost: item.unitCost,
        };
      })
      .filter(Boolean),
    receivedBy: req.user!._id,
    notes: req.body.notes,
  });

  await notifyStockReceived(po.companyId, grnNumber, po.poNumber);
  return sendSuccess(res, { purchaseOrder: po, grn });
}

export async function cancelPurchase(req: Request, res: Response) {
  const po = await PurchaseOrder.findOne({ _id: req.params.id, deletedAt: null });
  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);
  if (["received", "closed"].includes(po.status)) {
    throw new AppError("BAD_REQUEST", "Cannot cancel received purchase order", 400);
  }

  po.status = "cancelled";
  po.updatedBy = req.user!._id;
  await po.save();
  return sendSuccess(res, po);
}

export async function sendPurchaseToSupplier(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const po = await PurchaseOrder.findOne({ _id: req.params.id, ...tenant, deletedAt: null })
    .populate("supplierId", "name contactPerson phone email")
    .populate("branchId", "name code")
    .populate("items.productId", "name sku")
    .lean();

  if (!po) throw new AppError("NOT_FOUND", "Purchase order not found", 404);

  const supplier = po.supplierId as {
    _id?: string;
    name?: string;
    email?: string;
    contactPerson?: string;
  } | null;

  if (!supplier?.email) {
    throw new AppError("BAD_REQUEST", "Supplier does not have an email address on file", 400);
  }

  const { sendPurchaseOrderToSupplier } = await import("../services/purchase-email.service");
  await sendPurchaseOrderToSupplier(po, {
    name: supplier.name ?? "Supplier",
    email: supplier.email,
  });

  return sendSuccess(res, {
    message: `Purchase order sent to ${supplier.email}`,
    sentTo: supplier.email,
  });
}
