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
