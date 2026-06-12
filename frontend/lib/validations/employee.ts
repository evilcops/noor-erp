import { z } from "zod";

export const employeeFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  branchId: z.string().min(1, "Branch is required"),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]),
  joiningDate: z.string().min(1, "Joining date is required"),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  status: z.enum(["active", "on_leave", "suspended", "resigned", "terminated", "archived"]),
  notes: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
