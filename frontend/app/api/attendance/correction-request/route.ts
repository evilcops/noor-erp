import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { correctionRequestSchema } from "@/lib/server/schemas/attendance.schema";

export const POST = apiRoute({
  controller: attendanceController.requestCorrection,
  auth: true,
  permission: { resource: "attendance", action: "create" },
  validate: { schema: correctionRequestSchema },
  audit: "attendance",
  apiPath: "/attendance/correction-request",
});
