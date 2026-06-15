import type { Types } from "mongoose";
import type { IBranch } from "../models/Branch.model.js";

export function startOfDay(date: Date | string = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateBranchLocation(
  branch: IBranch | null,
  lat?: number,
  lng?: number
): { distance?: number; outOfRadius: boolean; addressNote?: string } {
  if (!branch?.gpsCoordinates || lat == null || lng == null) {
    return { outOfRadius: false };
  }
  const distance = haversineMeters(
    lat,
    lng,
    branch.gpsCoordinates.lat,
    branch.gpsCoordinates.lng
  );
  const outOfRadius = distance > branch.allowedRadius;
  return {
    distance,
    outOfRadius,
    addressNote: outOfRadius ? `[OUT_OF_RADIUS:${Math.round(distance)}m]` : undefined,
  };
}

export function computeAttendanceMetrics(
  date: Date,
  timeIn?: Date | null,
  timeOut?: Date | null
) {
  const day = startOfDay(date);
  const workStart = new Date(day);
  workStart.setHours(8, 0, 0, 0);
  const workEnd = new Date(day);
  workEnd.setHours(17, 0, 0, 0);

  let isLate = false;
  let lateMinutes = 0;
  let isEarlyLeave = false;
  let earlyLeaveMinutes = 0;
  let totalHours: number | undefined;
  let status: "present" | "late" | "absent" | "half_day" = "absent";

  if (timeIn) {
    if (timeIn > workStart) {
      isLate = true;
      lateMinutes = Math.floor((timeIn.getTime() - workStart.getTime()) / 60000);
    }
    status = isLate ? "late" : "present";
  }

  if (timeIn && timeOut) {
    totalHours = (timeOut.getTime() - timeIn.getTime()) / 3600000;
    if (timeOut < workEnd) {
      isEarlyLeave = true;
      earlyLeaveMinutes = Math.floor((workEnd.getTime() - timeOut.getTime()) / 60000);
    }
    if (totalHours < 4) status = "half_day";
  }

  return { isLate, lateMinutes, isEarlyLeave, earlyLeaveMinutes, totalHours, status };
}

export function isHrRole(role: string) {
  return ["super_admin", "business_owner", "hr_manager", "branch_manager"].includes(role);
}

export function resolveEmployeeId(
  bodyEmployeeId: Types.ObjectId | string | undefined,
  userEmployeeId?: Types.ObjectId | string | null,
  userRole?: string
): string {
  if (bodyEmployeeId && isHrRole(userRole ?? "")) {
    return String(bodyEmployeeId);
  }
  if (userEmployeeId) return String(userEmployeeId);
  throw new Error("EMPLOYEE_REQUIRED");
}
