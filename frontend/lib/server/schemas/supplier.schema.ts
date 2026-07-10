import { z } from "zod";

export const createSupplierSchema = z.object({
  companyId: z.string().min(1).optional(),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  country: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  paymentTerms: z.string().optional(),
  deliveryLeadTimeDays: z.number().min(0).optional(),
  notes: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  status: z.enum(["active", "inactive", "blacklisted", "archived"]).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().omit({ companyId: true });
