import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { approveCorrectionSchema } from "@/lib/server/schemas/attendance.schema";

export const PUT = apiRoute({
  controller: attendanceController.approveCorrection,
  auth: true,
  permission: { resource: "attendance", action: "approve" },
  validate: { schema: approveCorrectionSchema },
  audit: "attendance",
  apiPath: "/attendance/correction/:id/approve",
});
