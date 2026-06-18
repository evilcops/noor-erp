import { z } from "zod";

const complianceDocSchema = z.object({
  issuanceDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

const complianceDocsSchema = z.object({
  passport: complianceDocSchema.optional(),
  driving_license: complianceDocSchema.optional(),
  bataka: complianceDocSchema.optional(),
  /** Only required/relevant when hasVehicle is true — enforced at controller level */
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
  relationship: z.enum(["spouse", "son", "daughter", "parents"]),
  bataka: familyMemberBatakaSchema.optional(),
});

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
  hasVehicle: z.boolean().optional(),
  complianceDocs: complianceDocsSchema.optional(),
  familyType: z.enum(["individual", "family"]).optional(),
  familyMembers: z.array(familyMemberSchema).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .omit({ companyId: true, branchId: true })
  .extend({
    status: z
      .enum(["active", "on_leave", "suspended", "resigned", "terminated", "archived"])
      .optional(),
  });
