import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(20),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  taxId: z.string().optional(),
  registrationNumber: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();
