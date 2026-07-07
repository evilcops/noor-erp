/** Normalize Oman mobile numbers to digits with country code (968XXXXXXXX). */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("968") && digits.length >= 11) {
    return digits.slice(0, 11);
  }
  if (digits.length === 8) {
    return `968${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 9) {
    return `968${digits.slice(1)}`;
  }

  return digits;
}

/** Build phone variants for matching existing records stored in different formats. */
export function phoneLookupVariants(phone: string): string[] {
  const trimmed = phone.trim();
  const normalized = normalizePhone(trimmed);
  const local = normalized.startsWith("968") ? normalized.slice(3) : normalized;

  return [
    ...new Set(
      [trimmed, normalized, local, `+${normalized}`, `968${local}`, `0${local}`].filter(Boolean)
    ),
  ];
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 11 && normalized.startsWith("968")) {
    return `+${normalized.slice(0, 3)} ${normalized.slice(3)}`;
  }
  return phone;
}
