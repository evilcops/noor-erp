const DATE_LOCALE = "en-GB";

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Display date as DD/MM/YYYY */
export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Display date and time as DD/MM/YYYY, HH:MM */
export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateRange(
  start?: string | Date | null,
  end?: string | Date | null
): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}
