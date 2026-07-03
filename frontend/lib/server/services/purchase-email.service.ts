import { sendEmail } from "./email.service";

type PoLine = {
  productId: { name?: string; sku?: string } | string;
  quantityOrdered: number;
  unitCost: number;
};

type PurchaseOrderEmailData = {
  poNumber: string;
  status: string;
  totalAmount: number;
  notes?: string;
  branchId: { name?: string } | string;
  items: PoLine[];
};

function refName(ref: string | { name?: string } | undefined) {
  if (!ref || typeof ref === "string") return ref ?? "—";
  return ref.name ?? "—";
}

function formatAmount(value: number) {
  return `${value.toFixed(3)} OMR`;
}

function buildPurchaseOrderEmailHtml(po: PurchaseOrderEmailData, supplierName: string) {
  const rows = po.items
    .map((item) => {
      const name = typeof item.productId === "object" ? item.productId.name ?? "Product" : "Product";
      const sku = typeof item.productId === "object" ? item.productId.sku ?? "" : "";
      const lineTotal = item.quantityOrdered * item.unitCost;
      return `<tr>
        <td style="padding:8px;border:1px solid #e5e7eb;">${name}${sku ? ` <span style="color:#6b7280">(${sku})</span>` : ""}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${item.quantityOrdered}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatAmount(item.unitCost)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatAmount(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;">
      <h2 style="margin:0 0 8px;">Purchase Order ${po.poNumber}</h2>
      <p style="margin:0 0 16px;color:#4b5563;">Dear ${supplierName},</p>
      <p style="margin:0 0 16px;">Please find our purchase order details below.</p>
      <p style="margin:0 0 8px;"><strong>Branch:</strong> ${refName(po.branchId)}</p>
      <p style="margin:0 0 16px;"><strong>Status:</strong> ${po.status.replace(/_/g, " ")}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#1e4078;color:#fff;">
            <th style="padding:8px;text-align:left;">Product</th>
            <th style="padding:8px;text-align:center;">Qty</th>
            <th style="padding:8px;text-align:right;">Unit Cost</th>
            <th style="padding:8px;text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:16px 0 8px;text-align:right;font-size:16px;"><strong>Total: ${formatAmount(po.totalAmount)}</strong></p>
      ${po.notes ? `<p style="margin:0;color:#4b5563;"><strong>Notes:</strong> ${po.notes}</p>` : ""}
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">This message was sent from NOOR ERP.</p>
    </div>
  `;
}

function buildPurchaseOrderEmailText(po: PurchaseOrderEmailData, supplierName: string) {
  const lines = po.items.map((item) => {
    const name = typeof item.productId === "object" ? item.productId.name ?? "Product" : "Product";
    return `- ${name}: ${item.quantityOrdered} x ${formatAmount(item.unitCost)}`;
  });

  return [
    `Dear ${supplierName},`,
    "",
    `Purchase Order ${po.poNumber}`,
    `Branch: ${refName(po.branchId)}`,
    `Status: ${po.status}`,
    "",
    ...lines,
    "",
    `Total: ${formatAmount(po.totalAmount)}`,
    po.notes ? `Notes: ${po.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendPurchaseOrderToSupplier(
  po: PurchaseOrderEmailData,
  supplier: { name: string; email: string }
) {
  const html = buildPurchaseOrderEmailHtml(po, supplier.name);
  const text = buildPurchaseOrderEmailText(po, supplier.name);

  await sendEmail({
    to: supplier.email,
    subject: `Purchase Order ${po.poNumber} — NOOR ERP`,
    html,
    text,
  });
}
