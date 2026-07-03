import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Sale } from "@/types/customer";
import { openPdfForPrint, pdfFormatAmount, pdfFormatDate, pdfRefName } from "./receipt-utils";

function buildSaleReceiptDoc(sale: Sale, companyName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setFontSize(14);
  doc.text("SALES RECEIPT", pageWidth / 2, y, { align: "center" });

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Receipt #: ${sale.saleNumber}`, 14, y);
  doc.text(`Date: ${pdfFormatDate(sale.createdAt)}`, pageWidth - 14, y, { align: "right" });

  y += 8;
  doc.setDrawColor(200);
  doc.line(14, y, pageWidth - 14, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Customer", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(`Name: ${pdfRefName(sale.customerId)}`, 14, y);
  y += 5;
  if (typeof sale.customerId === "object" && sale.customerId.phone) {
    doc.text(`Phone: ${sale.customerId.phone}`, 14, y);
    y += 5;
  }
  if (typeof sale.customerId === "object" && sale.customerId.email) {
    doc.text(`Email: ${sale.customerId.email}`, 14, y);
    y += 5;
  }

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.text("Branch", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(pdfRefName(sale.branchId), 14, y);

  const productName = pdfRefName(sale.productId);
  const sku = typeof sale.productId === "object" ? sale.productId.sku : "—";

  autoTable(doc, {
    startY: y + 8,
    head: [["Product", "SKU", "Qty", "Unit Price", "Total"]],
    body: [[productName, sku, String(sale.quantity), pdfFormatAmount(sale.unitPrice), pdfFormatAmount(sale.totalAmount)]],
    theme: "grid",
    headStyles: { fillColor: [30, 64, 120], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Grand Total: ${pdfFormatAmount(sale.totalAmount)}`, pageWidth - 14, finalY + 10, { align: "right" });

  if (sale.soldBy) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Sold by: ${pdfRefName(sale.soldBy)}`, 14, finalY + 10);
  }

  if (sale.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Notes: ${sale.notes}`, 14, finalY + 18, { maxWidth: pageWidth - 28 });
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Thank you for your purchase.", pageWidth / 2, finalY + 30, { align: "center" });

  return doc;
}

export function downloadSaleReceipt(sale: Sale, companyName = "NOOR ERP") {
  const doc = buildSaleReceiptDoc(sale, companyName);
  doc.save(`${sale.saleNumber}.pdf`);
}

export function printSaleReceipt(sale: Sale, companyName = "NOOR ERP") {
  const doc = buildSaleReceiptDoc(sale, companyName);
  openPdfForPrint(doc);
}
