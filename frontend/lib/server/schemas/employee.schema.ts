import { z } from "zod";

export const createEmployeeSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string(),
      relationship: z.string(),
      phone: z.string(),
    })
    .optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).optional(),
  joiningDate: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .omit({ companyId: true, branchId: true })
  .extend({
    status: z
      .enum(["active", "on_leave", "suspended", "resigned", "terminated", "archived"])
      .optional(),
  });
