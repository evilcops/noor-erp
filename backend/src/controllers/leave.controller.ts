import type { Request, Response } from "express";
import { Leave } from "../models/Leave.model.js";
import { LeaveBalance } from "../models/LeaveBalance.model.js";
import { Employee } from "../models/Employee.model.js";
import { createNotification } from "../services/notification.service.js";
import { buildTenantFilter } from "../services/permission.service.js";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

function daysBetween(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
}

export async function requestLeave(req: Request, res: Response) {
  if (!req.user!.employeeId) {
    throw new AppError("BAD_REQUEST", "User not linked to employee", 400);
  }
  const employee = await Employee.findById(req.user!.employeeId);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);

  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);
  const totalDays = daysBetween(startDate, endDate);

  const leave = await Leave.create({
    employeeId: employee._id,
    companyId: employee.companyId,
    branchId: employee.branchId,
    type: req.body.type,
    startDate,
    endDate,
    totalDays,
    reason: req.body.reason,
    attachmentUrl: req.body.attachmentUrl,
    status: "pending",
  });

  void createNotification({
    userId: req.user!._id,
    companyId: employee.companyId,
    type: "leave_request",
    title: "Leave request submitted",
    message: `Your ${req.body.type} leave request is pending approval`,
    data: { leaveId: leave._id },
  });

  return sendSuccess(res, leave, 201);
}

export async function listLeaves(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.branchId) filter.branchId = req.query.branchId;

  const [items, total] = await Promise.all([
    Leave.find(filter)
      .sort(buildSortQuery(sortBy, sortOrder))
      .skip(skip)
      .limit(limit)
      .populate("employeeId", "firstName lastName employeeId")
      .lean(),
    Leave.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getLeave(req: Request, res: Response) {
  const leave = await Leave.findById(req.params.id).populate(
    "employeeId",
    "firstName lastName"
  );
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);
  return sendSuccess(res, leave);
}

export async function approveLeave(req: Request, res: Response) {
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);

  leave.status = "approved";
  leave.approvedBy = req.user!._id;
  leave.approvedAt = new Date();
  await leave.save();

  void createNotification({
    userId: leave.employeeId,
    companyId: leave.companyId,
    type: "leave_approved",
    title: "Leave approved",
    message: `Your leave request from ${leave.startDate.toDateString()} was approved`,
    data: { leaveId: leave._id },
  });

  return sendSuccess(res, leave);
}

export async function rejectLeave(req: Request, res: Response) {
  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);

  leave.status = "rejected";
  leave.rejectionReason = req.body.rejectionReason;
  await leave.save();
  return sendSuccess(res, leave);
}

export async function getLeaveBalance(req: Request, res: Response) {
  const employeeId = req.query.employeeId ?? req.user!.employeeId;
  if (!employeeId) throw new AppError("BAD_REQUEST", "Employee ID required", 400);

  const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
  let balance = await LeaveBalance.findOne({ employeeId, year });

  if (!balance) {
    balance = await LeaveBalance.create({
      employeeId,
      companyId: req.user!.companyId,
      year,
      annual: { total: 30, used: 0, remaining: 30 },
      sick: { total: 14, used: 0, remaining: 14 },
      emergency: { total: 5, used: 0, remaining: 5 },
      unpaid: { total: 0, used: 0, remaining: 0 },
    });
  }

  return sendSuccess(res, balance);
}

export async function getLeaveCalendar(req: Request, res: Response) {
  const filter: Record<string, unknown> = {
    ...buildTenantFilter(req.user!),
    status: "approved",
  };
  if (req.query.fromDate || req.query.toDate) {
    filter.startDate = {};
    if (req.query.fromDate)
      (filter.startDate as Record<string, Date>).$gte = new Date(String(req.query.fromDate));
    if (req.query.toDate)
      (filter.endDate as Record<string, Date>) = { $lte: new Date(String(req.query.toDate)) };
  }

  const leaves = await Leave.find(filter)
    .populate("employeeId", "firstName lastName")
    .lean();
  return sendSuccess(res, leaves);
}
