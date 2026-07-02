import { z } from "zod";

export const recordSaleSchema = z
  .object({
    companyId: z.string().min(1),
    branchId: z.string().min(1),
    productId: z.string().min(1),
    quantity: z.number().min(1),
    customerId: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().email().optional().or(z.literal("")),
    customerName: z.string().optional(),
    unitPrice: z.number().min(0).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.customerId) ||
      Boolean(data.customerPhone && data.customerPhone.trim().length > 0),
    { message: "Customer phone or existing customer is required", path: ["customerPhone"] }
  );
