import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { createAttendanceSchema } from "@/lib/server/schemas/attendance.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: attendanceController.listAttendance,
    auth: true,
    permission: { resource: "attendance", action: "view" },
    audit: "attendance",
    apiPath: "/attendance",
  },
  POST: {
    controller: attendanceController.createAttendance,
    auth: true,
    permission: { resource: "attendance", action: "create" },
    validate: { schema: createAttendanceSchema },
    audit: "attendance",
    apiPath: "/attendance",
  },
});
