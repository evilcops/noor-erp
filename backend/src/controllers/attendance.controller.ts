import type { Request, Response } from "express";
import { Attendance } from "../models/Attendance.model.js";
import { Branch } from "../models/Branch.model.js";
import { Employee } from "../models/Employee.model.js";
import {
  computeAttendanceMetrics,
  isHrRole,
  startOfDay,
  validateBranchLocation,
} from "../services/attendance.service.js";
import {
  assertBranchAccess,
  buildTenantFilter,
} from "../services/permission.service.js";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

async function getEmployeeById(req: Request, employeeId: string) {
  const employee = await Employee.findOne({ _id: employeeId, deletedAt: null });
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);
  return employee;
}

async function getEmployeeForUser(req: Request) {
  if (!req.user!.employeeId) {
    throw new AppError("BAD_REQUEST", "User is not linked to an employee profile", 400);
  }
  return getEmployeeById(req, String(req.user!.employeeId));
}

function resolveTargetEmployeeId(req: Request): string {
  if (req.body.employeeId && isHrRole(req.user!.role)) {
    return String(req.body.employeeId);
  }
  if (req.user!.employeeId) return String(req.user!.employeeId);
  throw new AppError("BAD_REQUEST", "Employee is required", 400);
}

function buildAttendanceFilter(req: Request) {
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.fromDate || req.query.toDate) {
    filter.date = {};
    if (req.query.fromDate)
      (filter.date as Record<string, Date>).$gte = startOfDay(String(req.query.fromDate));
    if (req.query.toDate) {
      const to = startOfDay(String(req.query.toDate));
      to.setHours(23, 59, 59, 999);
      (filter.date as Record<string, Date>).$lte = to;
    }
  }
  return filter;
}

export async function listAttendance(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildAttendanceFilter(req);

  const [items, total] = await Promise.all([
    Attendance.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate("employeeId", "firstName lastName employeeId department")
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getAttendance(req: Request, res: Response) {
  const record = await Attendance.findOne({ _id: req.params.id, deletedAt: null })
    .populate("employeeId", "firstName lastName employeeId department")
    .lean();
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);
  return sendSuccess(res, record);
}

export async function createAttendance(req: Request, res: Response) {
  const employee = await getEmployeeById(req, resolveTargetEmployeeId(req));
  const branch = await Branch.findById(employee.branchId);
  const date = startOfDay(req.body.date);

  const existing = await Attendance.findOne({ employeeId: employee._id, date, deletedAt: null });
  if (existing) {
    throw new AppError("CONFLICT", "Attendance already exists for this employee on this date", 409);
  }

  const timeIn = req.body.timeIn ? new Date(req.body.timeIn) : undefined;
  const timeOut = req.body.timeOut ? new Date(req.body.timeOut) : undefined;
  const metrics = computeAttendanceMetrics(date, timeIn, timeOut);
  const status = req.body.status ?? metrics.status;

  let locationIn = req.body.locationIn;
  if (req.body.lat != null && req.body.lng != null) {
    const gps = validateBranchLocation(branch, req.body.lat, req.body.lng);
    locationIn = {
      lat: req.body.lat,
      lng: req.body.lng,
      address: [req.body.address, gps.addressNote].filter(Boolean).join(" ").trim() || undefined,
    };
  }

  const record = await Attendance.create({
    employeeId: employee._id,
    companyId: employee.companyId,
    branchId: employee.branchId,
    date,
    timeIn,
    timeOut,
    totalHours: metrics.totalHours,
    locationIn,
    locationOut: req.body.locationOut,
    deviceInfo: req.body.deviceInfo ?? "HR Entry",
    isLate: metrics.isLate,
    lateMinutes: metrics.lateMinutes,
    isEarlyLeave: metrics.isEarlyLeave,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    isMissedCheckout: req.body.isMissedCheckout ?? false,
    status,
    notes: req.body.notes,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  const populated = await Attendance.findById(record._id)
    .populate("employeeId", "firstName lastName employeeId department")
    .lean();

  return sendSuccess(res, populated, 201);
}

export async function updateAttendance(req: Request, res: Response) {
  const record = await Attendance.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);

  assertBranchAccess(req.user!, record.branchId, record.companyId);
  req.auditMeta = { oldValue: record.toObject() };

  const date = req.body.date ? startOfDay(req.body.date) : record.date;
  const timeIn = req.body.timeIn !== undefined
    ? req.body.timeIn ? new Date(req.body.timeIn) : undefined
    : record.timeIn;
  const timeOut = req.body.timeOut !== undefined
    ? req.body.timeOut ? new Date(req.body.timeOut) : undefined
    : record.timeOut;

  const metrics = computeAttendanceMetrics(date, timeIn, timeOut);

  if (req.body.date) record.date = date;
  if (req.body.timeIn !== undefined) record.timeIn = timeIn;
  if (req.body.timeOut !== undefined) record.timeOut = timeOut;
  if (req.body.notes !== undefined) record.notes = req.body.notes;
  if (req.body.status) record.status = req.body.status;
  if (req.body.isMissedCheckout !== undefined) record.isMissedCheckout = req.body.isMissedCheckout;
  if (req.body.locationIn) record.locationIn = req.body.locationIn;
  if (req.body.locationOut) record.locationOut = req.body.locationOut;
  if (req.body.deviceInfo) record.deviceInfo = req.body.deviceInfo;

  record.isLate = metrics.isLate;
  record.lateMinutes = metrics.lateMinutes;
  record.isEarlyLeave = metrics.isEarlyLeave;
  record.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
  record.totalHours = metrics.totalHours;
  if (!req.body.status && record.status !== "correction_pending" && record.status !== "approved_correction") {
    record.status = metrics.status;
  }
  record.updatedBy = req.user!._id;

  await record.save();

  const populated = await Attendance.findById(record._id)
    .populate("employeeId", "firstName lastName employeeId department")
    .lean();

  return sendSuccess(res, populated);
}

export async function deleteAttendance(req: Request, res: Response) {
  const record = await Attendance.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);

  assertBranchAccess(req.user!, record.branchId, record.companyId);
  req.auditMeta = { oldValue: record.toObject() };

  record.deletedAt = new Date();
  record.updatedBy = req.user!._id;
  await record.save();

  return sendSuccess(res, { message: "Attendance record deleted" });
}

export async function checkIn(req: Request, res: Response) {
  const employeeId = isHrRole(req.user!.role) && req.body.employeeId
    ? String(req.body.employeeId)
    : String((await getEmployeeForUser(req))._id);
  const employee = await getEmployeeById(req, employeeId);
  const branch = await Branch.findById(employee.branchId);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);

  const today = startOfDay();
  let record = await Attendance.findOne({ employeeId: employee._id, date: today, deletedAt: null });

  if (record?.timeIn) throw new AppError("CONFLICT", "Already checked in today", 409);

  const now = new Date();
  const metrics = computeAttendanceMetrics(today, now);
  const gps = validateBranchLocation(branch, req.body.lat, req.body.lng);

  const locationIn = {
    lat: req.body.lat,
    lng: req.body.lng,
    address: [req.body.address, gps.addressNote].filter(Boolean).join(" ").trim() || undefined,
  };

  if (!record) {
    record = await Attendance.create({
      employeeId: employee._id,
      companyId: employee.companyId,
      branchId: employee.branchId,
      date: today,
      timeIn: now,
      locationIn,
      deviceInfo: req.body.deviceInfo ?? "Web",
      isLate: metrics.isLate,
      lateMinutes: metrics.lateMinutes,
      status: metrics.status,
      notes: req.body.notes,
      createdBy: req.user!._id,
      updatedBy: req.user!._id,
    });
  } else {
    record.timeIn = now;
    record.locationIn = locationIn;
    record.isLate = metrics.isLate;
    record.lateMinutes = metrics.lateMinutes;
    record.status = metrics.status;
    record.updatedBy = req.user!._id;
    await record.save();
  }

  const populated = await Attendance.findById(record._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated, 201);
}

export async function checkOut(req: Request, res: Response) {
  const employeeId = isHrRole(req.user!.role) && req.body.employeeId
    ? String(req.body.employeeId)
    : String((await getEmployeeForUser(req))._id);
  const employee = await getEmployeeById(req, employeeId);

  const today = startOfDay();
  const record = await Attendance.findOne({ employeeId: employee._id, date: today, deletedAt: null });
  if (!record?.timeIn) throw new AppError("NOT_FOUND", "No check-in found for today", 404);
  if (record.timeOut) throw new AppError("CONFLICT", "Already checked out", 409);

  const now = new Date();
  const metrics = computeAttendanceMetrics(today, record.timeIn, now);

  record.timeOut = now;
  record.locationOut = { lat: req.body.lat, lng: req.body.lng, address: req.body.address };
  record.totalHours = metrics.totalHours;
  record.isEarlyLeave = metrics.isEarlyLeave;
  record.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
  record.status = metrics.status;
  record.updatedBy = req.user!._id;

  await record.save();

  const populated = await Attendance.findById(record._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated);
}

export async function getTodayAttendance(req: Request, res: Response) {
  const filter = { ...buildTenantFilter(req.user!), date: startOfDay(), deletedAt: null };
  const records = await Attendance.find(filter)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();
  return sendSuccess(res, records);
}

export async function getMyAttendance(req: Request, res: Response) {
  const employee = await getEmployeeForUser(req);
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { employeeId: employee._id, deletedAt: null };
  if (req.query.fromDate || req.query.toDate) {
    filter.date = {};
    if (req.query.fromDate)
      (filter.date as Record<string, Date>).$gte = startOfDay(String(req.query.fromDate));
    if (req.query.toDate) {
      const to = startOfDay(String(req.query.toDate));
      to.setHours(23, 59, 59, 999);
      (filter.date as Record<string, Date>).$lte = to;
    }
  }

  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Attendance.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getTeamAttendance(req: Request, res: Response) {
  const filter = { ...buildTenantFilter(req.user!), date: startOfDay(), deletedAt: null };
  const records = await Attendance.find(filter)
    .populate("employeeId", "firstName lastName employeeId department")
    .lean();
  return sendSuccess(res, records);
}

export async function requestCorrection(req: Request, res: Response) {
  const record = await Attendance.findOne({ _id: req.body.attendanceId, deletedAt: null });
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);

  req.auditMeta = { oldValue: record.toObject() };

  record.correctionRequest = {
    requestedTimeIn: req.body.requestedTimeIn
      ? new Date(req.body.requestedTimeIn)
      : undefined,
    requestedTimeOut: req.body.requestedTimeOut
      ? new Date(req.body.requestedTimeOut)
      : undefined,
    reason: req.body.reason,
    requestedAt: new Date(),
  };
  record.status = "correction_pending";
  record.updatedBy = req.user!._id;
  await record.save();

  const populated = await Attendance.findById(record._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated);
}

export async function approveCorrection(req: Request, res: Response) {
  const record = await Attendance.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);

  req.auditMeta = { oldValue: record.toObject() };

  if (req.body.approved) {
    if (record.correctionRequest?.requestedTimeIn)
      record.timeIn = record.correctionRequest.requestedTimeIn;
    if (record.correctionRequest?.requestedTimeOut)
      record.timeOut = record.correctionRequest.requestedTimeOut;

    const metrics = computeAttendanceMetrics(record.date, record.timeIn, record.timeOut);
    record.totalHours = metrics.totalHours;
    record.isLate = metrics.isLate;
    record.lateMinutes = metrics.lateMinutes;
    record.isEarlyLeave = metrics.isEarlyLeave;
    record.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
    record.status = "approved_correction";
    record.correctionRequest!.approvedBy = req.user!._id;
    record.correctionRequest!.approvedAt = new Date();
    record.approvedBy = req.user!._id;
  } else {
    record.status = record.isLate ? "late" : "present";
    record.correctionRequest!.rejectionReason = req.body.rejectionReason;
  }

  record.updatedBy = req.user!._id;
  await record.save();

  const populated = await Attendance.findById(record._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated);
}

export async function reportMissedCheckout(req: Request, res: Response) {
  const record = await Attendance.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);
  if (!record.timeIn) throw new AppError("BAD_REQUEST", "No check-in on this record", 400);

  req.auditMeta = { oldValue: record.toObject() };

  record.isMissedCheckout = true;
  if (req.body.timeOut) {
    record.timeOut = new Date(req.body.timeOut);
    const metrics = computeAttendanceMetrics(record.date, record.timeIn, record.timeOut);
    record.totalHours = metrics.totalHours;
    record.isEarlyLeave = metrics.isEarlyLeave;
    record.earlyLeaveMinutes = metrics.earlyLeaveMinutes;
  }
  record.status = "correction_pending";
  record.correctionRequest = {
    requestedTimeOut: req.body.timeOut ? new Date(req.body.timeOut) : undefined,
    reason: req.body.reason ?? "Missed checkout",
    requestedAt: new Date(),
  };
  record.updatedBy = req.user!._id;
  await record.save();

  const populated = await Attendance.findById(record._id)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();

  return sendSuccess(res, populated);
}

export async function attendanceReport(req: Request, res: Response) {
  const { generateAttendanceReport } = await import("../services/report.service.js");
  const data = await generateAttendanceReport(req.user!, req.query as Record<string, string>);
  return sendSuccess(res, data);
}
