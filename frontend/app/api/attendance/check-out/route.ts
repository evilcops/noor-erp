import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { checkOutSchema } from "@/lib/server/schemas/attendance.schema";

export const POST = apiRoute({
  controller: attendanceController.checkOut,
  auth: true,
  permission: { resource: "attendance", action: "create" },
  validate: { schema: checkOutSchema },
  audit: "attendance",
  apiPath: "/attendance/check-out",
});
