import { z } from "zod";

const requiredDocSchema = z.object({
  issuanceDate: z.string().min(1, "Issuance date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
});

const optionalDocSchema = z.object({
  issuanceDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const employeeFormSchema = z
  .object({
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
    // Compliance docs — always required
    hasVehicle: z.boolean().optional(),
    passport: requiredDocSchema,
    driving_license: requiredDocSchema,
    pataka: requiredDocSchema,
    // Vehicle docs — validated conditionally in superRefine
    mulkiya: optionalDocSchema.optional(),
    car_insurance: optionalDocSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasVehicle) {
      if (!data.mulkiya?.issuanceDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mulkiya", "issuanceDate"],
          message: "Issuance date is required",
        });
      }
      if (!data.mulkiya?.expiryDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mulkiya", "expiryDate"],
          message: "Expiry date is required",
        });
      }
      if (!data.car_insurance?.issuanceDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["car_insurance", "issuanceDate"],
          message: "Issuance date is required",
        });
      }
      if (!data.car_insurance?.expiryDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["car_insurance", "expiryDate"],
          message: "Expiry date is required",
        });
      }
    }
  });

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
