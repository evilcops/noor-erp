import { z } from "zod";

const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantityOrdered: z.number().min(1),
  unitCost: z.number().min(0),
  notes: z.string().optional(),
});

export const createPurchaseSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().min(1),
  supplierId: z.string().min(1),
  items: z.array(purchaseItemSchema).min(1),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePurchaseSchema = z.object({
  supplierId: z.string().optional(),
  items: z.array(purchaseItemSchema).optional(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  status: z
    .enum([
      "draft",
      "requested",
      "approved",
      "ordered",
      "in_transit",
      "partially_received",
      "received",
      "cancelled",
      "closed",
    ])
    .optional(),
});

export const amendPurchaseSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantityOrdered: z.number().min(1).optional(),
        newPurchaseCost: z.number().min(0).optional(),
        newSellingPrice: z.number().min(0).optional(),
      })
    )
    .min(1),
});

export const receivePurchaseSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantityReceived: z.number().min(0),
      })
    )
    .min(1),
  notes: z.string().optional(),
});
