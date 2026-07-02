import { z } from "zod";

const transferItemSchema = z.object({
  productId: z.string().min(1),
  quantityRequested: z.number().min(1),
  notes: z.string().optional(),
});

export const createStockTransferSchema = z.object({
  companyId: z.string().min(1),
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  items: z.array(transferItemSchema).min(1),
  notes: z.string().optional(),
});

export const dispatchTransferSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantityDispatched: z.number().min(0),
      })
    )
    .min(1),
});

export const receiveTransferSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantityReceived: z.number().min(0),
      })
    )
    .min(1),
});
