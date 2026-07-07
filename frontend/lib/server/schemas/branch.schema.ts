import { z } from "zod";

export const createBranchSchema = z.object({
  companyId: z.string().min(1),
  parentBranchId: z.string().optional().nullable(),
  name: z.string().min(1),
  code: z.string().min(2).max(20),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  managerId: z.string().optional(),
  gpsCoordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  allowedRadius: z.number().min(10).max(5000).optional(),
  deliveryRadiusKm: z.number().min(1).max(100).optional(),
  deliveryClusterCount: z.number().min(2).max(24).optional(),
});

export const updateBranchSchema = createBranchSchema.partial().omit({ companyId: true });

export const branchHolidaySchema = z.object({
  name: z.string().min(1),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  isRecurring: z.boolean().optional(),
});
