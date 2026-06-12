import type { Request, Response } from "express";
import { Attendance } from "../models/Attendance.model.js";
import { Branch } from "../models/Branch.model.js";
import { Employee } from "../models/Employee.model.js";
import { buildTenantFilter } from "../services/permission.service.js";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getEmployeeForUser(req: Request) {
  if (!req.user!.employeeId) {
    throw new AppError("BAD_REQUEST", "User is not linked to an employee profile", 400);
  }
  const employee = await Employee.findById(req.user!.employeeId);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  return employee;
}

export async function checkIn(req: Request, res: Response) {
  const employee = await getEmployeeForUser(req);
  const branch = await Branch.findById(employee.branchId);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);

  const today = startOfDay();
  let record = await Attendance.findOne({ employeeId: employee._id, date: today });

  if (record?.timeIn) throw new AppError("CONFLICT", "Already checked in today", 409);

  const now = new Date();
  let isLate = false;
  let lateMinutes = 0;
  const workStart = new Date(today);
  workStart.setHours(8, 0, 0, 0);
  if (now > workStart) {
    isLate = true;
    lateMinutes = Math.floor((now.getTime() - workStart.getTime()) / 60000);
  }

  if (branch.gpsCoordinates) {
    const distance = haversineMeters(
      req.body.lat,
      req.body.lng,
      branch.gpsCoordinates.lat,
      branch.gpsCoordinates.lng
    );
    if (distance > branch.allowedRadius) {
      // Flag but allow — manager can override later
      req.body.address = `${req.body.address ?? ""} [OUT_OF_RADIUS:${Math.round(distance)}m]`.trim();
    }
  }

  if (!record) {
    record = await Attendance.create({
      employeeId: employee._id,
      companyId: employee.companyId,
      branchId: employee.branchId,
      date: today,
      timeIn: now,
      locationIn: { lat: req.body.lat, lng: req.body.lng, address: req.body.address },
      deviceInfo: req.body.deviceInfo,
      isLate,
      lateMinutes,
      status: isLate ? "late" : "present",
    });
  } else {
    record.timeIn = now;
    record.locationIn = { lat: req.body.lat, lng: req.body.lng, address: req.body.address };
    record.isLate = isLate;
    record.lateMinutes = lateMinutes;
    record.status = isLate ? "late" : "present";
    await record.save();
  }

  return sendSuccess(res, record, 201);
}

export async function checkOut(req: Request, res: Response) {
  const employee = await getEmployeeForUser(req);
  const today = startOfDay();
  const record = await Attendance.findOne({ employeeId: employee._id, date: today });
  if (!record?.timeIn) throw new AppError("NOT_FOUND", "No check-in found for today", 404);
  if (record.timeOut) throw new AppError("CONFLICT", "Already checked out", 409);

  const now = new Date();
  record.timeOut = now;
  record.locationOut = { lat: req.body.lat, lng: req.body.lng, address: req.body.address };
  record.totalHours = (now.getTime() - record.timeIn!.getTime()) / 3600000;

  const workEnd = new Date(today);
  workEnd.setHours(17, 0, 0, 0);
  if (now < workEnd) {
    record.isEarlyLeave = true;
    record.earlyLeaveMinutes = Math.floor((workEnd.getTime() - now.getTime()) / 60000);
  }

  await record.save();
  return sendSuccess(res, record);
}

export async function getTodayAttendance(req: Request, res: Response) {
  const filter = { ...buildTenantFilter(req.user!), date: startOfDay() };
  const records = await Attendance.find(filter)
    .populate("employeeId", "firstName lastName employeeId")
    .lean();
  return sendSuccess(res, records);
}

export async function getMyAttendance(req: Request, res: Response) {
  const employee = await getEmployeeForUser(req);
  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { employeeId: employee._id };
  if (req.query.fromDate || req.query.toDate) {
    filter.date = {};
    if (req.query.fromDate)
      (filter.date as Record<string, Date>).$gte = new Date(String(req.query.fromDate));
    if (req.query.toDate)
      (filter.date as Record<string, Date>).$lte = new Date(String(req.query.toDate));
  }

  const [items, total] = await Promise.all([
    Attendance.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Attendance.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getTeamAttendance(req: Request, res: Response) {
  const filter = { ...buildTenantFilter(req.user!), date: startOfDay() };
  const records = await Attendance.find(filter)
    .populate("employeeId", "firstName lastName employeeId department")
    .lean();
  return sendSuccess(res, records);
}

export async function requestCorrection(req: Request, res: Response) {
  const record = await Attendance.findById(req.body.attendanceId);
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);

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
  await record.save();
  return sendSuccess(res, record);
}

export async function approveCorrection(req: Request, res: Response) {
  const record = await Attendance.findById(req.params.id);
  if (!record) throw new AppError("NOT_FOUND", "Attendance record not found", 404);

  if (req.body.approved) {
    if (record.correctionRequest?.requestedTimeIn)
      record.timeIn = record.correctionRequest.requestedTimeIn;
    if (record.correctionRequest?.requestedTimeOut)
      record.timeOut = record.correctionRequest.requestedTimeOut;
    record.status = "approved_correction";
    record.correctionRequest!.approvedBy = req.user!._id;
    record.correctionRequest!.approvedAt = new Date();
    record.approvedBy = req.user!._id;
  } else {
    record.status = record.isLate ? "late" : "present";
    record.correctionRequest!.rejectionReason = req.body.rejectionReason;
  }

  await record.save();
  return sendSuccess(res, record);
}

export async function attendanceReport(req: Request, res: Response) {
  const { generateAttendanceReport } = await import("../services/report.service.js");
  const data = await generateAttendanceReport(req.user!, req.query as Record<string, string>);
  return sendSuccess(res, data);
}
