import { z } from "zod";

export const leaveRequestSchema = z.object({
  type: z.enum(["annual", "sick", "emergency", "unpaid", "maternity", "paternity", "other"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

export const rejectLeaveSchema = z.object({
  rejectionReason: z.string().min(1),
});
