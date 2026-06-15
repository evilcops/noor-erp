import { z } from "zod";

export const leaveRequestSchema = z.object({
  employeeId: z.string().optional(),
  type: z.enum(["annual", "sick", "emergency", "unpaid", "maternity", "paternity", "other"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  attachmentUrl: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
});

export const updateLeaveSchema = leaveRequestSchema.partial();

export const rejectLeaveSchema = z.object({
  rejectionReason: z.string().min(1),
});
