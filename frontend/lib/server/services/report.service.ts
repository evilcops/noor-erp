import type { FilterQuery } from "mongoose";
import { Employee } from "../models/Employee.model";
import { Attendance } from "../models/Attendance.model";
import { Leave } from "../models/Leave.model";
import { Recruitment } from "../models/Recruitment.model";
import { Performance } from "../models/Performance.model";
import type { IUser } from "../models/User.model";
import { buildTenantFilter } from "./permission.service";

function applyDateRange(
  filter: Record<string, unknown>,
  fromDate?: string,
  toDate?: string,
  field = "createdAt"
) {
  if (fromDate || toDate) {
    filter[field] = {};
    if (fromDate) (filter[field] as Record<string, Date>).$gte = new Date(fromDate);
    if (toDate) (filter[field] as Record<string, Date>).$lte = new Date(toDate);
  }
}

export async function generateEmployeeReport(
  user: IUser,
  filters: Record<string, string | undefined>
) {
  const query: FilterQuery<typeof Employee> = {
    ...buildTenantFilter(user),
  };
  if (filters.branchId) query.branchId = filters.branchId;
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    query.$or = [
      { firstName: new RegExp(filters.search, "i") },
      { lastName: new RegExp(filters.search, "i") },
      { email: new RegExp(filters.search, "i") },
      { employeeId: new RegExp(filters.search, "i") },
    ];
  }
  return Employee.find(query).sort({ createdAt: -1 }).lean();
}

export async function generateAttendanceReport(
  user: IUser,
  filters: Record<string, string | undefined>
) {
  const query: FilterQuery<typeof Attendance> = {
    ...buildTenantFilter(user),
    deletedAt: null,
  };
  if (filters.branchId) query.branchId = filters.branchId;
  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.status) query.status = filters.status;
  applyDateRange(query, filters.fromDate, filters.toDate, "date");
  return Attendance.find(query).sort({ date: -1 }).populate("employeeId", "firstName lastName employeeId department").lean();
}

export async function generateLeaveReport(
  user: IUser,
  filters: Record<string, string | undefined>
) {
  const query: FilterQuery<typeof Leave> = {
    ...buildTenantFilter(user),
  };
  if (filters.status) query.status = filters.status;
  applyDateRange(query, filters.fromDate, filters.toDate, "startDate");
  return Leave.find(query).sort({ createdAt: -1 }).populate("employeeId", "firstName lastName").lean();
}

export async function generateRecruitmentReport(
  user: IUser,
  filters: Record<string, string | undefined>
) {
  const query: FilterQuery<typeof Recruitment> = {
    ...buildTenantFilter(user),
  };
  if (filters.status) query.status = filters.status;
  if (filters.branchId) query.branchId = filters.branchId;
  return Recruitment.find(query).sort({ createdAt: -1 }).lean();
}

export async function generatePerformanceReport(
  user: IUser,
  filters: Record<string, string | undefined>
) {
  const query: FilterQuery<typeof Performance> = {
    ...buildTenantFilter(user),
  };
  if (filters.status) query.status = filters.status;
  return Performance.find(query).sort({ createdAt: -1 }).populate("employeeId", "firstName lastName").lean();
}
