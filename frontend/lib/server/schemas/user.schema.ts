import { z } from "zod";
import { ROLES } from "../config/constants";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(ROLES),
  companyId: z.string().optional(),
  branchId: z.string().optional(),
  useCustomPermissions: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(ROLES).optional(),
  companyId: z.string().optional(),
  branchId: z.string().optional(),
  isActive: z.boolean().optional(),
  useCustomPermissions: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});
