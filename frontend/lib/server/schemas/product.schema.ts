import { z } from "zod";

export const createProductSchema = z.object({
  companyId: z.string().min(1).optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  brand: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  specifications: z.string().optional(),
  purchaseCost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  unitOfMeasure: z.string().optional(),
  minStockLevel: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  images: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "discontinued", "out_of_stock", "archived"]).optional(),
  notes: z.string().optional(),
  initialStock: z
    .object({
      branchId: z.string(),
      quantity: z.number().min(0),
    })
    .optional(),
});

export const updateProductSchema = createProductSchema.partial().omit({ companyId: true });

export const stockAdjustmentSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number(),
  type: z.enum(["adjustment", "damaged", "returned", "manual_correction"]),
  reason: z.string().min(1),
  notes: z.string().optional(),
});
