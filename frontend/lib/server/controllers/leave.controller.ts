import type { Request, Response } from "express";
import { Leave } from "../models/Leave.model";
import { LeaveBalance } from "../models/LeaveBalance.model";
import { Employee } from "../models/Employee.model";
import { isHrRole } from "../services/attendance.service";
import { createNotification } from "../services/notification.service";
import {
  assertBranchAccess,
  buildTenantFilter,
} from "../services/permission.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

function daysBetween(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
}

function applyLeaveDateFilter(
  filter: Record<string, unknown>,
  fromDate?: string,
  toDate?: string
) {
  if (!fromDate && !toDate) return;

  const conditions: Record<string, unknown>[] = [];
  if (fromDate) {
    conditions.push({ endDate: { $gte: new Date(fromDate) } });
  }
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    conditions.push({ startDate: { $lte: to } });
  }

  if (conditions.length === 1) {
    Object.assign(filter, conditions[0]);
  } else if (conditions.length > 1) {
    filter.$and = [...((filter.$and as Record<string, unknown>[]) ?? []), ...conditions];
  }
}

async function getEmployeeById(req: Request, employeeId: string) {
  const employee = await Employee.findOne({ _id: employeeId, deletedAt: null });
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);
  return employee;
}

function resolveTargetEmployeeId(req: Request): string {
  if (req.body.employeeId && isHrRole(req.user!.role)) {
    return String(req.body.employeeId);
  }
  if (req.user!.employeeId) return String(req.user!.employeeId);
  throw new AppError("BAD_REQUEST", "Employee is required", 400);
}

export async function requestLeave(req: Request, res: Response) {
  const employee = await getEmployeeById(req, resolveTargetEmployeeId(req));

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
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  void createNotification({
    userId: req.user!._id,
    companyId: employee.companyId,
    type: "leave_request",
    title: "Leave request submitted",
    message: `${employee.firstName} ${employee.lastName}'s ${req.body.type} leave request is ${leave.status}`,
    data: { leaveId: leave._id },
  });

  const populated = await Leave.findById(leave._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated, 201);
}

export async function listLeaves(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  applyLeaveDateFilter(
    filter,
    req.query.fromDate ? String(req.query.fromDate) : undefined,
    req.query.toDate ? String(req.query.toDate) : undefined
  );

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
  const leave = await Leave.findOne({ _id: req.params.id, deletedAt: null }).populate(
    "employeeId",
    "firstName lastName employeeId"
  );
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);
  return sendSuccess(res, leave);
}

export async function updateLeave(req: Request, res: Response) {
  const leave = await Leave.findOne({ _id: req.params.id, deletedAt: null });
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);

  assertBranchAccess(req.user!, leave.branchId, leave.companyId);
  req.auditMeta = { oldValue: leave.toObject() };

  if (req.body.type) leave.type = req.body.type;
  if (req.body.reason !== undefined) leave.reason = req.body.reason;
  if (req.body.status) leave.status = req.body.status;
  if (req.body.attachmentUrl !== undefined) leave.attachmentUrl = req.body.attachmentUrl;

  if (req.body.startDate || req.body.endDate) {
    const startDate = req.body.startDate ? new Date(req.body.startDate) : leave.startDate;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : leave.endDate;
    leave.startDate = startDate;
    leave.endDate = endDate;
    leave.totalDays = daysBetween(startDate, endDate);
  }

  leave.updatedBy = req.user!._id;
  await leave.save();

  const populated = await Leave.findById(leave._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated);
}

export async function deleteLeave(req: Request, res: Response) {
  const leave = await Leave.findOne({ _id: req.params.id, deletedAt: null });
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);

  assertBranchAccess(req.user!, leave.branchId, leave.companyId);
  req.auditMeta = { oldValue: leave.toObject() };

  leave.status = "cancelled";
  leave.deletedAt = new Date();
  leave.updatedBy = req.user!._id;
  await leave.save();

  return sendSuccess(res, { message: "Leave request cancelled" });
}

export async function approveLeave(req: Request, res: Response) {
  const leave = await Leave.findOne({ _id: req.params.id, deletedAt: null });
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);

  req.auditMeta = { oldValue: leave.toObject() };

  leave.status = "approved";
  leave.approvedBy = req.user!._id;
  leave.approvedAt = new Date();
  leave.updatedBy = req.user!._id;
  await leave.save();

  void createNotification({
    userId: leave.employeeId,
    companyId: leave.companyId,
    type: "leave_approved",
    title: "Leave approved",
    message: `Leave request from ${leave.startDate.toDateString()} was approved`,
    data: { leaveId: leave._id },
  });

  const populated = await Leave.findById(leave._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated);
}

export async function rejectLeave(req: Request, res: Response) {
  const leave = await Leave.findOne({ _id: req.params.id, deletedAt: null });
  if (!leave) throw new AppError("NOT_FOUND", "Leave not found", 404);

  req.auditMeta = { oldValue: leave.toObject() };

  leave.status = "rejected";
  leave.rejectionReason = req.body.rejectionReason;
  leave.updatedBy = req.user!._id;
  await leave.save();

  const populated = await Leave.findById(leave._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated);
}

export async function getLeaveBalance(req: Request, res: Response) {
  const employeeId = req.query.employeeId ?? req.user!.employeeId;
  if (!employeeId) throw new AppError("BAD_REQUEST", "Employee ID required", 400);

  const employee = await getEmployeeById(req, String(employeeId));

  const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
  let balance = await LeaveBalance.findOne({ employeeId: employee._id, year });

  if (!balance) {
    balance = await LeaveBalance.create({
      employeeId: employee._id,
      companyId: employee.companyId,
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
    deletedAt: null,
  };
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  applyLeaveDateFilter(
    filter,
    req.query.fromDate ? String(req.query.fromDate) : undefined,
    req.query.toDate ? String(req.query.toDate) : undefined
  );

  const leaves = await Leave.find(filter)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();
  return sendSuccess(res, leaves);
}
