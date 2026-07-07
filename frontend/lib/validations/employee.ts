import { z } from "zod";

const requiredDocSchema = z.object({
  issuanceDate: z.string().min(1, "Issuance date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
});

const optionalDocSchema = z.object({
  issuanceDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

const leaveBalanceFormSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  annualTotal: z.coerce.number().min(0, "Annual leave days required"),
  sickTotal: z.coerce.number().min(0, "Sick leave days required"),
  emergencyTotal: z.coerce.number().min(0, "Emergency leave days required"),
  unpaidTotal: z.coerce.number().min(0, "Unpaid leave days required"),
  maternityTotal: z.coerce.number().min(0, "Maternity leave days required"),
  paternityTotal: z.coerce.number().min(0, "Paternity leave days required"),
});

export const employeeFormSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email required"),
    gender: z.enum(["male", "female", "other"], { message: "Gender is required" }),
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
    bataka: requiredDocSchema,
    // Vehicle docs — validated conditionally in superRefine
    mulkiya: optionalDocSchema.optional(),
    car_insurance: optionalDocSchema.optional(),
    createUserAccount: z.boolean().optional(),
    userPassword: z.string().optional(),
    userRole: z
      .enum([
        "super_admin",
        "business_owner",
        "branch_manager",
        "hr_manager",
        "inventory_manager",
        "procurement_manager",
        "rider",
        "employee",
      ])
      .optional(),
    registerAsRider: z.boolean().optional(),
    riderVehicleMake: z.string().optional(),
    riderVehicleModel: z.string().optional(),
    riderVehiclePlate: z.string().optional(),
    riderWhatsappPhone: z.string().optional(),
    leaveBalance: leaveBalanceFormSchema,
    leaveBalanceUsed: z
      .object({
        annual: z.number().optional(),
        sick: z.number().optional(),
        emergency: z.number().optional(),
        unpaid: z.number().optional(),
        maternity: z.number().optional(),
        paternity: z.number().optional(),
      })
      .optional(),
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
    if (data.createUserAccount && (!data.userPassword || data.userPassword.length < 8)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["userPassword"],
        message: "Password must be at least 8 characters",
      });
    }
    if (data.registerAsRider && (!data.userPassword || data.userPassword.length < 8)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["userPassword"],
        message: "Rider login password must be at least 8 characters",
      });
    }
  });

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
