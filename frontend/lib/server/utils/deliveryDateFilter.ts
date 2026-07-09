import { AppError } from "./AppError";

export function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateRequired(input: string): Date {
  const parts = input.trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new AppError("BAD_REQUEST", "Invalid date", 400);
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) throw new AppError("BAD_REQUEST", "Invalid date", 400);
  return d;
}

export function parseDeliveryDateRange(query: Record<string, unknown>) {
  const legacyDate = typeof query.date === "string" ? query.date : undefined;
  const fromInput = typeof query.dateFrom === "string" ? query.dateFrom : legacyDate;
  const toInput = typeof query.dateTo === "string" ? query.dateTo : legacyDate;
  const start = parseDateRequired(fromInput ?? toInput ?? formatLocalDate(new Date()));
  const end = parseDateRequired(toInput ?? fromInput ?? formatLocalDate(new Date()));
  if (start > end) {
    throw new AppError("BAD_REQUEST", "dateFrom must be on or before dateTo", 400);
  }
  return {
    start,
    end,
    dateFrom: formatLocalDate(start),
    dateTo: formatLocalDate(end),
  };
}

export function deliveryInDateRangeQuery(from: Date, to: Date) {
  const rangeEnd = new Date(to);
  rangeEnd.setHours(23, 59, 59, 999);
  return {
    $or: [
      { scheduledDate: { $gte: from, $lte: rangeEnd } },
      { promisedWindowStart: { $gte: from, $lte: rangeEnd } },
    ],
  };
}

/** For models with a single scheduledDate field (e.g. delivery runs). */
export function scheduledDateInRangeQuery(from: Date, to: Date) {
  const rangeEnd = new Date(to);
  rangeEnd.setHours(23, 59, 59, 999);
  return { scheduledDate: { $gte: from, $lte: rangeEnd } };
}
