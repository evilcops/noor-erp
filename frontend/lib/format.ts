export function getEmployeeLabel(
  employeeId:
    | { firstName?: string; lastName?: string; employeeId?: string }
    | string
    | null
    | undefined
): string {
  if (!employeeId || typeof employeeId === "string") return "—";
  const name = [employeeId.firstName, employeeId.lastName].filter(Boolean).join(" ");
  return name || employeeId.employeeId || "—";
}

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
