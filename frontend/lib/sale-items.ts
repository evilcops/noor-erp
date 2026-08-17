import type { Sale, SaleItem } from "@/types/customer";

/** Normalize legacy single-product sales and multi-item carts into one list. */
export function getSaleLineItems(sale: Sale): SaleItem[] {
  if (sale.items && sale.items.length > 0) return sale.items;
  return [
    {
      productId: sale.productId,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      lineTotal: sale.totalAmount,
    },
  ];
}

export function saleProductLabel(
  productId: SaleItem["productId"] | Sale["productId"] | undefined
) {
  if (!productId || typeof productId === "string") return productId ?? "—";
  return productId.name ?? productId.sku ?? "—";
}

export function saleProductSku(productId: SaleItem["productId"] | Sale["productId"] | undefined) {
  if (!productId || typeof productId === "string") return "—";
  return productId.sku ?? "—";
}
