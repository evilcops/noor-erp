import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Sale } from "../models/Sale.model";
import { Delivery } from "../models/Delivery.model";
import { buildTenantFilter } from "../services/permission.service";
import { ensureStoreAppRiderAssigned } from "../services/delivery.service";
import {
  syncProductStockStatus,
  updateStockLevel,
} from "../services/inventory.service";
import {
  buildMeta,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

/** Cancel allowed until the rider has started the route (loaded / dispatched / in transit). */
export function canCancelAppOrderDelivery(delivery: {
  status?: string;
  warehouseStatus?: string;
  assignmentLocked?: boolean;
} | null | undefined) {
  if (!delivery) return true;
  if (
    delivery.status === "cancelled" ||
    delivery.status === "delivered" ||
    delivery.status === "refused"
  ) {
    return false;
  }
  if (delivery.status === "in_transit") return false;
  if (delivery.assignmentLocked) return false;
  if (delivery.warehouseStatus === "loaded" || delivery.warehouseStatus === "dispatched") {
    return false;
  }
  return ["pending_assignment", "scheduled", "rescheduled"].includes(
    delivery.status || "scheduled"
  );
}

const TERMINAL_DELIVERY_STATUSES = new Set([
  "cancelled",
  "delivered",
  "refused",
  "failed",
]);

/** Staff view: orders placed from the customer store app. */
export async function listAppOrders(req: Request, res: Response) {
  if (!req.user) throw new AppError("UNAUTHORIZED", "Authentication required", 401);

  const tenant = buildTenantFilter(req.user);
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {
    ...tenant,
    $or: [{ source: "store" }, { notes: /Online store order/i }],
  };

  if (req.query.branchId) filter.branchId = String(req.query.branchId);
  if (req.query.search) {
    const q = String(req.query.search);
    filter.saleNumber = new RegExp(q, "i");
  }

  const deliveryStatusParam = req.query.deliveryStatus
    ? String(req.query.deliveryStatus).trim()
    : "";

  if (deliveryStatusParam) {
    const deliveryStatus =
      deliveryStatusParam === "completed" ? "delivered" : deliveryStatusParam;

    if (deliveryStatusParam === "cancelled") {
      const cancelledDeliveries = await Delivery.find({
        ...tenant,
        deletedAt: null,
        status: "cancelled",
      })
        .select("saleId")
        .lean();
      const cancelledSaleIds = cancelledDeliveries
        .map((d) => d.saleId)
        .filter(Boolean);
      filter.$and = [
        {
          $or: [{ status: "cancelled" }, { _id: { $in: cancelledSaleIds } }],
        },
      ];
    } else {
      const matchingDeliveries = await Delivery.find({
        ...tenant,
        deletedAt: null,
        status: deliveryStatus,
      })
        .select("saleId")
        .lean();
      const saleIds = matchingDeliveries.map((d) => d.saleId).filter(Boolean);
      filter._id = { $in: saleIds };
    }
  }

  const [items, total] = await Promise.all([
    Sale.find(filter)
      .populate("customerId", "name phone email address area")
      .populate("productId", "name sku images")
      .populate("items.productId", "name sku images")
      .populate("branchId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Sale.countDocuments(filter),
  ]);

  const saleIds = items.map((s) => s._id);
  const deliveries = await Delivery.find({
    saleId: { $in: saleIds },
    deletedAt: null,
  }).lean();

  // Auto-heal unassigned store deliveries when staff opens App Orders
  for (const delivery of deliveries) {
    if (TERMINAL_DELIVERY_STATUSES.has(delivery.status)) continue;
    if (!delivery.riderId || delivery.orderSource === "store_app") {
      await ensureStoreAppRiderAssigned(String(delivery._id));
    }
  }

  const refreshed = await Delivery.find({
    saleId: { $in: saleIds },
    deletedAt: null,
  })
    .populate({
      path: "riderId",
      select: "riderCode status currentLocation",
      populate: { path: "employeeId", select: "firstName lastName phone" },
    })
    .lean();
  const bySaleFresh = new Map(refreshed.map((d) => [String(d.saleId), d]));

  const enriched = items.map((sale) => {
    const delivery = bySaleFresh.get(String(sale._id));
    const rider = delivery?.riderId;
    let riderName: string | undefined;
    let riderCode: string | undefined;
    if (rider && typeof rider === "object") {
      riderCode = (rider as { riderCode?: string }).riderCode;
      const emp = (rider as { employeeId?: { firstName?: string; lastName?: string } }).employeeId;
      if (emp && typeof emp === "object") {
        riderName = [emp.firstName, emp.lastName].filter(Boolean).join(" ").trim() || undefined;
      }
    }
    const saleStatus = (sale as { status?: string }).status || "open";
    return {
      ...sale,
      status: saleStatus,
      delivery: delivery
        ? {
            _id: String(delivery._id),
            deliveryNumber: delivery.deliveryNumber,
            status: delivery.status,
            warehouseStatus: delivery.warehouseStatus,
            orderSource: delivery.orderSource,
            promisedWindowStart: delivery.promisedWindowStart,
            promisedWindowEnd: delivery.promisedWindowEnd,
            estimatedArrival: delivery.estimatedArrival,
            travelTimeMinutes: delivery.travelTimeMinutes,
            assignmentLocked: delivery.assignmentLocked,
          }
        : null,
      riderAssigned: Boolean(delivery?.riderId),
      riderCode,
      riderName,
      canCancel:
        saleStatus !== "cancelled" &&
        saleStatus !== "completed" &&
        delivery?.status !== "delivered" &&
        delivery?.status !== "refused" &&
        canCancelAppOrderDelivery(delivery),
    };
  });

  return sendSuccess(res, enriched, 200, buildMeta(page, limit, total));
}

export async function assignAppOrderRider(req: Request, res: Response) {
  if (!req.user) throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  const tenant = buildTenantFilter(req.user);

  const sale = await Sale.findOne({
    _id: req.params.id,
    ...tenant,
    $or: [{ source: "store" }, { notes: /Online store order/i }],
  });
  if (!sale) throw new AppError("NOT_FOUND", "App order not found", 404);
  if ((sale as { status?: string }).status === "cancelled") {
    throw new AppError("BAD_REQUEST", "Order is already cancelled", 400);
  }

  const delivery = await Delivery.findOne({ saleId: sale._id, deletedAt: null });
  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found for this order", 404);
  if (delivery.status === "cancelled") {
    throw new AppError("BAD_REQUEST", "Delivery is cancelled", 400);
  }

  await ensureStoreAppRiderAssigned(String(delivery._id));
  const populated = await Delivery.findById(delivery._id)
    .populate({
      path: "riderId",
      select: "riderCode status",
      populate: { path: "employeeId", select: "firstName lastName" },
    })
    .lean();

  if (!populated?.riderId) {
    throw new AppError(
      "BAD_REQUEST",
      "No rider available for this branch. Create/activate a rider under Riders for this branch first.",
      400
    );
  }

  return sendSuccess(res, populated);
}

export async function cancelAppOrder(req: Request, res: Response) {
  if (!req.user) throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  const tenant = buildTenantFilter(req.user);
  const reason =
    typeof req.body?.reason === "string" && req.body.reason.trim()
      ? String(req.body.reason).trim()
      : "Cancelled from App Orders";

  const sale = await Sale.findOne({
    _id: req.params.id,
    ...tenant,
    $or: [{ source: "store" }, { notes: /Online store order/i }],
  });
  if (!sale) throw new AppError("NOT_FOUND", "App order not found", 404);

  if ((sale as { status?: string }).status === "cancelled") {
    throw new AppError("BAD_REQUEST", "Order is already cancelled", 400);
  }

  const delivery = await Delivery.findOne({ saleId: sale._id, deletedAt: null });
  if (!canCancelAppOrderDelivery(delivery)) {
    throw new AppError(
      "BAD_REQUEST",
      "Order cannot be cancelled after the rider has started the route",
      400
    );
  }

  const lineItems =
    sale.items && sale.items.length > 0
      ? sale.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      : [{ productId: sale.productId, quantity: sale.quantity }];

  for (const line of lineItems) {
    await updateStockLevel({
      companyId: sale.companyId,
      branchId: sale.branchId,
      productId: line.productId,
      quantity: line.quantity,
      type: "returned",
      reason: `Cancelled store order ${sale.saleNumber}`,
      referenceType: "Sale",
      referenceId: sale._id,
      userId: req.user._id,
    });
    await syncProductStockStatus(line.productId);
  }

  if (delivery) {
    delivery.status = "cancelled";
    delivery.failureReason = reason;
    delivery.riderId = undefined;
    delivery.provisionalRiderId = undefined;
    delivery.assignmentLocked = false;
    delivery.updatedBy = new mongoose.Types.ObjectId(String(req.user._id));
    await delivery.save();
  }

  sale.set("status", "cancelled");
  sale.set("cancelledAt", new Date());
  sale.set("cancelledBy", req.user._id);
  sale.set("cancelReason", reason);
  const notes = sale.notes?.trim() || "";
  if (!/\[CANCELLED\]/i.test(notes)) {
    sale.notes = notes ? `${notes} [CANCELLED]` : "[CANCELLED]";
  }
  await sale.save();

  return sendSuccess(res, {
    _id: String(sale._id),
    saleNumber: sale.saleNumber,
    status: "cancelled",
    deliveryStatus: delivery?.status ?? "cancelled",
  });
}
