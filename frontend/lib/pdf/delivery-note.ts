import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Delivery } from "@/types/delivery";
import { openPdfForPrint, pdfFormatAmount, pdfFormatDate, pdfRefName } from "./receipt-utils";

function buildDeliveryNoteDoc(delivery: Delivery, companyName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setFontSize(14);
  doc.text("DELIVERY NOTE", pageWidth / 2, y, { align: "center" });

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Delivery #: ${delivery.deliveryNumber}`, 14, y);
  doc.text(`Date: ${pdfFormatDate(delivery.scheduledDate ?? delivery.createdAt)}`, pageWidth - 14, y, {
    align: "right",
  });

  y += 8;
  doc.line(14, y, pageWidth - 14, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Deliver To", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(`Name: ${pdfRefName(delivery.customerId)}`, 14, y);
  y += 5;
  if (delivery.deliveryAddress) {
    doc.text(`Address: ${delivery.deliveryAddress}`, 14, y);
    y += 5;
  }
  if (delivery.area) {
    doc.text(`Area: ${delivery.area}`, 14, y);
    y += 5;
  }

  y += 3;
  const sale = delivery.saleId;
  if (typeof sale === "object") {
    doc.setFont("helvetica", "bold");
    doc.text("Order Details", 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Sale #", "Product", "Qty", "Amount"]],
      body: [
        [
          sale.saleNumber,
          typeof sale.productId === "object" ? sale.productId?.name ?? "—" : "—",
          String(sale.quantity),
          pdfFormatAmount(sale.totalAmount),
        ],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (delivery.timeSlotStart && delivery.timeSlotEnd) {
    doc.text(
      `Time slot: ${new Date(delivery.timeSlotStart).toLocaleTimeString()} – ${new Date(delivery.timeSlotEnd).toLocaleTimeString()}`,
      14,
      y
    );
    y += 6;
  }

  if (delivery.riderId && typeof delivery.riderId === "object") {
    const emp = delivery.riderId.employeeId;
    const riderName =
      typeof emp === "object" ? `${emp.firstName} ${emp.lastName}` : delivery.riderId.riderCode;
    doc.text(`Rider: ${riderName} (${delivery.riderId.riderCode})`, 14, y);
  }

  y += 20;
  doc.line(14, y, 80, y);
  doc.text("Customer Signature", 14, y + 5);

  return doc;
}

export function printDeliveryNote(delivery: Delivery, companyName = "NOOR ERP") {
  const doc = buildDeliveryNoteDoc(delivery, companyName);
  openPdfForPrint(doc);
}
