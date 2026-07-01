import { z } from "zod";
import { LEAVE_TYPES_REQUIRING_DOCUMENT } from "../../../lib/leave/constants";

const leaveTypeSchema = z.enum([
  "annual",
  "sick",
  "emergency",
  "unpaid",
  "maternity",
  "paternity",
  "other",
]);

export const leaveRequestBodySchema = z.object({
  employeeId: z.string().optional(),
  type: leaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  attachmentUrl: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
});

function requireSupportingDocument(
  data: { type?: string; attachmentUrl?: string },
  ctx: z.RefinementCtx
) {
  if (
    data.type &&
    (LEAVE_TYPES_REQUIRING_DOCUMENT as readonly string[]).includes(data.type) &&
    !data.attachmentUrl
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["attachmentUrl"],
      message:
        "Supporting document is required for sick, emergency, maternity, and paternity leave",
    });
  }
}

export const leaveRequestSchema = leaveRequestBodySchema.superRefine(requireSupportingDocument);

export const updateLeaveSchema = leaveRequestBodySchema.partial();

export const rejectLeaveSchema = z.object({
  rejectionReason: z.string().min(1),
});
