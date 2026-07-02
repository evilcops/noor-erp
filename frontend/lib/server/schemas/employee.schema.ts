import { z } from "zod";
import { validateFamilyMembers, normalizeFamilyMembers } from "../../employee/family";
import { ROLES } from "../config/constants";

const complianceDocSchema = z.object({
  issuanceDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

const complianceDocsSchema = z.object({
  passport: complianceDocSchema.optional(),
  driving_license: complianceDocSchema.optional(),
  bataka: complianceDocSchema.optional(),
  mulkiya: complianceDocSchema.optional().nullable(),
  car_insurance: complianceDocSchema.optional().nullable(),
});

const familyMemberBatakaSchema = z.object({
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  fileUrl: z.string().optional(),
  status: z.enum(["valid", "expired", "expiring_soon"]).optional(),
});

const familyMemberSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  profilePicture: z.string().optional(),
  relationship: z.enum(["spouse", "son", "daughter", "mother", "father", "parents"]),
  bataka: familyMemberBatakaSchema.optional(),
});

const userAccountRefine = (data: { createUserAccount?: boolean; userPassword?: string }, ctx: z.RefinementCtx) => {
  if (data.createUserAccount && !data.userPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["userPassword"],
      message: "Password is required when creating a user account",
    });
  }
};

const familyMembersRefine = (
  data: {
    gender?: "male" | "female" | "other";
    familyMembers?: Array<{ name: string; relationship: string }>;
  },
  ctx: z.RefinementCtx
) => {
  if (!data.familyMembers?.length || !data.gender) return;

  const normalizedMembers = normalizeFamilyMembers(
    data.familyMembers as Array<{ name: string; relationship: string }>
  );

  for (const issue of validateFamilyMembers(normalizedMembers, data.gender)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: issue.path.split("."),
      message: issue.message,
    });
  }
};

const leaveBalanceBucketSchema = z.object({
  total: z.number().min(0, "Must be 0 or greater"),
});

const leaveBalanceSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  annual: leaveBalanceBucketSchema,
  sick: leaveBalanceBucketSchema,
  emergency: leaveBalanceBucketSchema,
  unpaid: leaveBalanceBucketSchema,
  maternity: leaveBalanceBucketSchema,
  paternity: leaveBalanceBucketSchema,
});

const employeeBodySchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  gender: z.enum(["male", "female", "other"]),
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
  hasVehicle: z.boolean().optional(),
  complianceDocs: complianceDocsSchema.optional(),
  familyType: z.enum(["individual", "family"]).optional(),
  familyMembers: z.array(familyMemberSchema).optional(),
  createUserAccount: z.boolean().optional(),
  userPassword: z.string().min(8).optional(),
  userRole: z.enum(ROLES).optional(),
  leaveBalance: leaveBalanceSchema,
});

const employeeUpdateBodySchema = employeeBodySchema
  .partial()
  .omit({ companyId: true, branchId: true })
  .extend({
    status: z
      .enum(["active", "on_leave", "suspended", "resigned", "terminated", "archived"])
      .optional(),
    leaveBalance: leaveBalanceSchema.optional(),
  });

export const createEmployeeSchema = employeeBodySchema
  .superRefine(userAccountRefine)
  .superRefine(familyMembersRefine);

export const updateEmployeeSchema = employeeUpdateBodySchema
  .superRefine(userAccountRefine)
  .superRefine(familyMembersRefine);
