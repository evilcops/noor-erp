import type { Request, Response } from "express";
import {
  confirmDeliveryPromise,
  getDemandQueue,
  getFleetDispatchSnapshot,
  handleCustomerUnavailable,
  handleRiderBreakdown,
  offerRescheduleWindows,
  optimiseFleetPlan,
  predictDeliveryPromise,
} from "../services/dispatch-engine.service";
import { processStandingOrdersDue } from "../services/standing-order.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { parseDeliveryDateRange } from "../utils/deliveryDateFilter";

export async function getWarehouseQueue(req: Request, res: Response) {
  const companyId = String(req.user!.companyId ?? req.query.companyId ?? "");
  const branchId = String(req.query.branchId ?? req.user!.branchId ?? "");
  if (!companyId || !branchId) throw new AppError("BAD_REQUEST", "companyId and branchId are required", 400);

  const queue = await getDemandQueue(companyId, branchId);
  return sendSuccess(res, queue);
}

export async function runFleetOptimisation(req: Request, res: Response) {
  const companyId = String(req.user!.companyId ?? req.body.companyId ?? "");
  const branchId = String(req.body.branchId ?? req.user!.branchId ?? "");
  if (!companyId || !branchId) throw new AppError("BAD_REQUEST", "companyId and branchId are required", 400);

  const { trigger } = req.body as { trigger?: string };

  const result = await optimiseFleetPlan({
    companyId,
    branchId,
    trigger: trigger ?? "manual",
  });

  return sendSuccess(res, result);
}

export async function predictPromise(req: Request, res: Response) {
  const {
    companyId,
    branchId,
    coordinates,
    totalAmount,
    quantity,
    preparationMinutes,
    earliestAcceptableAt,
    orderSource,
  } = req.body as {
    companyId: string;
    branchId: string;
    coordinates?: { lat: number; lng: number };
    totalAmount: number;
    quantity: number;
    preparationMinutes?: number;
    earliestAcceptableAt?: string;
    orderSource?: string;
  };

  const prediction = await predictDeliveryPromise({
    companyId,
    branchId,
    coordinates,
    totalAmount,
    quantity,
    preparationMinutes,
    earliestAcceptableAt: earliestAcceptableAt ? new Date(earliestAcceptableAt) : undefined,
    orderSource: orderSource as import("../services/dispatch-engine.service").OrderSource | undefined,
  });

  return sendSuccess(res, prediction);
}

export async function getFleetSnapshot(req: Request, res: Response) {
  const companyId = String(req.user!.companyId ?? req.query.companyId ?? "");
  const branchId = String(req.query.branchId ?? req.user!.branchId ?? "");
  if (!companyId || !branchId) throw new AppError("BAD_REQUEST", "companyId and branchId are required", 400);

  const { start, end } = parseDeliveryDateRange(req.query as Record<string, unknown>);
  const snapshot = await getFleetDispatchSnapshot(companyId, branchId, { start, end });
  return sendSuccess(res, snapshot);
}

export async function rescheduleWindows(req: Request, res: Response) {
  const { earliestAcceptableAt } = req.body as { earliestAcceptableAt?: string };
  const windows = await offerRescheduleWindows(
    String(req.params.id),
    earliestAcceptableAt ? new Date(earliestAcceptableAt) : undefined
  );
  if (!windows) throw new AppError("NOT_FOUND", "Delivery not found", 404);
  return sendSuccess(res, windows);
}

export async function confirmPromise(req: Request, res: Response) {
  const { promisedWindowStart, promisedWindowEnd } = req.body as {
    promisedWindowStart: string;
    promisedWindowEnd: string;
  };
  const delivery = await confirmDeliveryPromise(String(req.params.id), {
    start: new Date(promisedWindowStart),
    end: new Date(promisedWindowEnd),
  });
  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found", 404);
  return sendSuccess(res, delivery);
}

export async function riderBreakdown(req: Request, res: Response) {
  const { riderId } = req.body as { riderId: string };
  if (!riderId) throw new AppError("BAD_REQUEST", "riderId is required", 400);
  const result = await handleRiderBreakdown(riderId);
  return sendSuccess(res, result);
}

export async function processStandingOrders(req: Request, res: Response) {
  const companyId = String(req.user!.companyId ?? req.body.companyId ?? "");
  const branchId = String(req.body.branchId ?? req.user!.branchId ?? "");
  if (!companyId || !branchId) throw new AppError("BAD_REQUEST", "companyId and branchId are required", 400);

  const result = await processStandingOrdersDue({
    companyId,
    branchId,
    userId: String(req.user!._id),
  });

  if (result.processed > 0) {
    void optimiseFleetPlan({ companyId, branchId, trigger: "standing_orders_due" });
  }

  return sendSuccess(res, result);
}
