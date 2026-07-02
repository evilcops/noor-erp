export const LEAVE_BALANCE_TYPES = [
  "annual",
  "sick",
  "emergency",
  "unpaid",
  "maternity",
  "paternity",
] as const;

export type LeaveBalanceType = (typeof LEAVE_BALANCE_TYPES)[number];

/** Leave types that require a supporting document when applying */
export const LEAVE_TYPES_REQUIRING_DOCUMENT = [
  "sick",
  "emergency",
  "maternity",
  "paternity",
] as const;

export function leaveTypeRequiresDocument(type: string): boolean {
  return (LEAVE_TYPES_REQUIRING_DOCUMENT as readonly string[]).includes(type);
}

export const DEFAULT_PATERNITY_LEAVE_DAYS = 3;
export const DEFAULT_MATERNITY_LEAVE_DAYS = 50;

export type EmployeeGender = "male" | "female" | "other";

export function maternityLeaveForGender(gender?: string | null): boolean {
  return gender === "female";
}

export function paternityLeaveForGender(gender?: string | null): boolean {
  return gender === "male";
}

export function leaveBalanceTypesForGender(gender?: string | null): LeaveBalanceType[] {
  return LEAVE_BALANCE_TYPES.filter((type) => {
    if (type === "maternity") return maternityLeaveForGender(gender);
    if (type === "paternity") return paternityLeaveForGender(gender);
    return true;
  });
}

export function isLeaveTypeAllowedForGender(type: string, gender?: string | null): boolean {
  if (type === "maternity") return maternityLeaveForGender(gender);
  if (type === "paternity") return paternityLeaveForGender(gender);
  return true;
}
