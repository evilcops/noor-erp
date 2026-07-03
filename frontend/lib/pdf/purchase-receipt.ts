import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PurchaseOrder } from "@/types/purchase";
import { openPdfForPrint, pdfFormatAmount, pdfFormatDate, pdfFormatStatus, pdfRefName } from "./receipt-utils";

function buildPurchaseReceiptDoc(po: PurchaseOrder, companyName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setFontSize(14);
  doc.text("PURCHASE ORDER", pageWidth / 2, y, { align: "center" });

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`PO #: ${po.poNumber}`, 14, y);
  doc.text(`Status: ${pdfFormatStatus(po.status)}`, pageWidth - 14, y, { align: "right" });

  y += 6;
  doc.text(`Created: ${pdfFormatDate(po.createdAt)}`, 14, y);
  if (po.orderedAt) {
    doc.text(`Ordered: ${pdfFormatDate(po.orderedAt)}`, pageWidth - 14, y, { align: "right" });
  }

  y += 8;
  doc.setDrawColor(200);
  doc.line(14, y, pageWidth - 14, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Supplier", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(`Name: ${pdfRefName(po.supplierId)}`, 14, y);
  y += 5;
  if (typeof po.supplierId === "object" && po.supplierId.contactPerson) {
    doc.text(`Contact: ${po.supplierId.contactPerson}`, 14, y);
    y += 5;
  }
  if (typeof po.supplierId === "object" && po.supplierId.phone) {
    doc.text(`Phone: ${po.supplierId.phone}`, 14, y);
    y += 5;
  }

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.text("Deliver To", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(pdfRefName(po.branchId), 14, y);

  const rows = po.items.map((item) => {
    const lineTotal = item.quantityOrdered * item.unitCost;
    return [
      pdfRefName(item.productId),
      typeof item.productId === "object" ? item.productId.sku : "—",
      `${item.quantityReceived}/${item.quantityOrdered}`,
      pdfFormatAmount(item.unitCost),
      pdfFormatAmount(lineTotal),
    ];
  });

  autoTable(doc, {
    startY: y + 8,
    head: [["Product", "SKU", "Rcvd/Ord", "Unit Cost", "Line Total"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [30, 64, 120], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total Amount: ${pdfFormatAmount(po.totalAmount)}`, pageWidth - 14, finalY + 10, { align: "right" });

  if (po.expectedDeliveryDate) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Expected Delivery: ${pdfFormatDate(po.expectedDeliveryDate)}`, 14, finalY + 10);
  }

  if (po.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Notes: ${po.notes}`, 14, finalY + 18, { maxWidth: pageWidth - 28 });
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("This is a system-generated purchase order document.", pageWidth / 2, finalY + 30, { align: "center" });

  return doc;
}

export function downloadPurchaseReceipt(po: PurchaseOrder, companyName = "NOOR ERP") {
  const doc = buildPurchaseReceiptDoc(po, companyName);
  doc.save(`${po.poNumber}.pdf`);
}

export function printPurchaseReceipt(po: PurchaseOrder, companyName = "NOOR ERP") {
  const doc = buildPurchaseReceiptDoc(po, companyName);
  openPdfForPrint(doc);
}
