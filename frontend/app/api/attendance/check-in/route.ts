import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { checkInSchema } from "@/lib/server/schemas/attendance.schema";

export const POST = apiRoute({
  controller: attendanceController.checkIn,
  auth: true,
  permission: { resource: "attendance", action: "create" },
  validate: { schema: checkInSchema },
  audit: "attendance",
  apiPath: "/attendance/check-in",
});
