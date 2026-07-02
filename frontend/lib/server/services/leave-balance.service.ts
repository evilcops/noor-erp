import type { Types } from "mongoose";
import { LeaveBalance, type ILeaveBalance, type ILeaveBalanceBucket } from "../models/LeaveBalance.model";
import {
  DEFAULT_MATERNITY_LEAVE_DAYS,
  DEFAULT_PATERNITY_LEAVE_DAYS,
  maternityLeaveForGender,
  paternityLeaveForGender,
} from "../../../lib/leave/constants";
import { AppError } from "../utils/AppError";

export type LeaveBalanceInput = {
  year?: number;
  annual: { total: number };
  sick: { total: number };
  emergency: { total: number };
  unpaid: { total: number };
  maternity: { total: number };
  paternity: { total: number };
};

type LeaveType = "annual" | "sick" | "emergency" | "unpaid" | "maternity" | "paternity";

const BALANCE_LEAVE_TYPES: LeaveType[] = [
  "annual",
  "sick",
  "emergency",
  "unpaid",
  "maternity",
  "paternity",
];

export function isBalanceLeaveType(type: string): type is LeaveType {
  return (BALANCE_LEAVE_TYPES as string[]).includes(type);
}

function defaultBuckets() {
  return {
    annual: bucketFromTotal(30),
    sick: bucketFromTotal(14),
    emergency: bucketFromTotal(5),
    unpaid: bucketFromTotal(0),
    maternity: bucketFromTotal(DEFAULT_MATERNITY_LEAVE_DAYS),
    paternity: bucketFromTotal(DEFAULT_PATERNITY_LEAVE_DAYS),
  };
}

function emptyMaternityBucket(): ILeaveBalanceBucket {
  return bucketFromTotal(DEFAULT_MATERNITY_LEAVE_DAYS);
}

function emptyPaternityBucket(): ILeaveBalanceBucket {
  return bucketFromTotal(DEFAULT_PATERNITY_LEAVE_DAYS);
}

async function getOrCreateBalanceForYear(
  employeeId: Types.ObjectId | string,
  companyId: Types.ObjectId | string,
  year: number
) {
  let balance = await LeaveBalance.findOne({ employeeId, year });
  if (!balance) {
    balance = await LeaveBalance.create({
      employeeId,
      companyId,
      year,
      ...defaultBuckets(),
    });
  }
  return balance;
}

export async function deductLeaveFromBalance(
  employeeId: Types.ObjectId | string,
  companyId: Types.ObjectId | string,
  leaveType: string,
  days: number,
  year: number
) {
  if (!isBalanceLeaveType(leaveType) || days <= 0) return null;

  const balance = await getOrCreateBalanceForYear(employeeId, companyId, year);
  const bucket = balance[leaveType];

  if (leaveType !== "unpaid" && bucket.remaining < days) {
    throw new AppError(
      "BAD_REQUEST",
      `Insufficient ${leaveType} leave balance (${bucket.remaining} day${bucket.remaining === 1 ? "" : "s"} remaining)`,
      400
    );
  }

  bucket.used += days;
  bucket.remaining = Math.max(0, bucket.total - bucket.used);
  balance.markModified(leaveType);
  await balance.save();
  return balance;
}

export async function restoreLeaveToBalance(
  employeeId: Types.ObjectId | string,
  companyId: Types.ObjectId | string,
  leaveType: string,
  days: number,
  year: number
) {
  if (!isBalanceLeaveType(leaveType) || days <= 0) return null;

  const balance = await LeaveBalance.findOne({ employeeId, year });
  if (!balance) return null;

  const bucket = balance[leaveType];
  bucket.used = Math.max(0, bucket.used - days);
  bucket.remaining = Math.max(0, bucket.total - bucket.used);
  balance.markModified(leaveType);
  await balance.save();
  return balance;
}

export async function syncLeaveBalanceForStatusChange(
  leave: {
    employeeId: Types.ObjectId | string;
    companyId: Types.ObjectId | string;
    type: string;
    totalDays: number;
    startDate: Date;
  },
  previousStatus: string,
  nextStatus: string
) {
  const year = new Date(leave.startDate).getFullYear();

  if (previousStatus !== "approved" && nextStatus === "approved") {
    return deductLeaveFromBalance(
      leave.employeeId,
      leave.companyId,
      leave.type,
      leave.totalDays,
      year
    );
  }

  if (previousStatus === "approved" && nextStatus !== "approved") {
    return restoreLeaveToBalance(
      leave.employeeId,
      leave.companyId,
      leave.type,
      leave.totalDays,
      year
    );
  }

  return null;
}

function bucketFromTotal(total: number, used = 0): ILeaveBalanceBucket {
  const safeTotal = Math.max(0, total);
  const safeUsed = Math.min(Math.max(0, used), safeTotal);
  return {
    total: safeTotal,
    used: safeUsed,
    remaining: Math.max(0, safeTotal - safeUsed),
  };
}

function updateBucket(existing: ILeaveBalanceBucket | undefined, newTotal: number): ILeaveBalanceBucket {
  const used = existing?.used ?? 0;
  if (newTotal < used) {
    throw new AppError(
      "BAD_REQUEST",
      `Leave total cannot be less than already used days (${used})`,
      400
    );
  }
  return bucketFromTotal(newTotal, used);
}

export async function getLeaveBalanceForEmployee(employeeId: Types.ObjectId | string, year?: number) {
  const y = year ?? new Date().getFullYear();
  return LeaveBalance.findOne({ employeeId, year });
}

export function normalizeLeaveBalanceForGender(
  input: LeaveBalanceInput,
  gender?: string | null
): LeaveBalanceInput {
  return {
    ...input,
    maternity: {
      total: maternityLeaveForGender(gender) ? input.maternity.total : 0,
    },
    paternity: {
      total: paternityLeaveForGender(gender) ? input.paternity.total : 0,
    },
  };
}

export async function createLeaveBalanceForEmployee(
  employeeId: Types.ObjectId | string,
  companyId: Types.ObjectId | string,
  input: LeaveBalanceInput
) {
  const year = input.year ?? new Date().getFullYear();
  const existing = await LeaveBalance.findOne({ employeeId, year });
  if (existing) {
    throw new AppError("CONFLICT", "Leave balance already exists for this employee", 409);
  }

  return LeaveBalance.create({
    employeeId,
    companyId,
    year,
    annual: bucketFromTotal(input.annual.total),
    sick: bucketFromTotal(input.sick.total),
    emergency: bucketFromTotal(input.emergency.total),
    unpaid: bucketFromTotal(input.unpaid.total),
    maternity: bucketFromTotal(input.maternity.total),
    paternity: bucketFromTotal(input.paternity.total),
  });
}

export async function upsertLeaveBalanceForEmployee(
  employeeId: Types.ObjectId | string,
  companyId: Types.ObjectId | string,
  input: LeaveBalanceInput
) {
  const year = input.year ?? new Date().getFullYear();
  let balance = await LeaveBalance.findOne({ employeeId, year });

  if (!balance) {
    return createLeaveBalanceForEmployee(employeeId, companyId, input);
  }

  (["annual", "sick", "emergency", "unpaid", "maternity", "paternity"] as LeaveType[]).forEach((type) => {
    balance![type] = updateBucket(balance![type], input[type].total);
  });

  await balance.save();
  return balance;
}

export function formatLeaveBalance(balance: ILeaveBalance) {
  return {
    year: balance.year,
    annual: balance.annual,
    sick: balance.sick,
    emergency: balance.emergency,
    unpaid: balance.unpaid,
    maternity: balance.maternity ?? emptyMaternityBucket(),
    paternity: balance.paternity ?? emptyPaternityBucket(),
  };
}
