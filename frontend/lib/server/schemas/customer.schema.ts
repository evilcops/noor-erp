import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid customer id");

const optionalEmail = z
  .union([z.string().email(), z.literal(""), z.undefined()])
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

export const createCustomerSchema = z.object({
  companyId: z.string().min(1).optional(),
  phone: z.string().min(1),
  email: optionalEmail,
  name: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  notes: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  phone: z.string().min(1).optional(),
  email: optionalEmail,
  name: z.string().optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  notes: z.string().optional(),
});

const saleItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0).optional(),
});

export const recordSaleSchema = z
  .object({
    companyId: z.string().min(1).optional(),
    branchId: z.string().min(1),
    /** Legacy single-product fields — still accepted and normalized into items. */
    productId: z.string().min(1).optional(),
    quantity: z.number().min(1).optional(),
    unitPrice: z.number().min(0).optional(),
    items: z.array(saleItemInputSchema).min(1).optional(),
    customerId: objectId.optional(),
    customerPhone: z.string().optional(),
    customerEmail: optionalEmail,
    customerName: z.string().optional(),
    customerAddress: z.string().optional(),
    customerArea: z.string().optional(),
    notes: z.string().optional(),
    promisedWindowStart: z.string().optional(),
    promisedWindowEnd: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.items && data.items.length > 0) ||
      Boolean(data.productId && data.quantity && data.quantity >= 1),
    { message: "Provide items or productId with quantity", path: ["items"] }
  )
  .refine(
    (data) =>
      Boolean(data.customerId) ||
      Boolean(data.customerPhone && normalizePhone(data.customerPhone).length > 0),
    { message: "Customer phone or existing customer is required", path: ["customerPhone"] }
  );
