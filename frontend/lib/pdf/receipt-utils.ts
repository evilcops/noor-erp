export function pdfRefName(
  ref: string | { name?: string; sku?: string; firstName?: string; lastName?: string; phone?: string; email?: string } | undefined
) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  if (ref.firstName || ref.lastName) return [ref.firstName, ref.lastName].filter(Boolean).join(" ");
  return ref.name ?? ref.sku ?? "—";
}

export function pdfFormatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pdfFormatAmount(value?: number) {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(3)} OMR`;
}

export function pdfFormatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function openPdfForPrint(doc: import("jspdf").jsPDF) {
  doc.autoPrint();
  const url = doc.output("bloburl");
  const win = window.open(url, "_blank");
  if (win) {
    win.addEventListener("load", () => win.print());
  }
}
