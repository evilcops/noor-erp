import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { updateAttendanceSchema } from "@/lib/server/schemas/attendance.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: attendanceController.getAttendance,
    auth: true,
    permission: { resource: "attendance", action: "view" },
    audit: "attendance",
    apiPath: "/attendance/:id",
  },
  PUT: {
    controller: attendanceController.updateAttendance,
    auth: true,
    permission: { resource: "attendance", action: "edit" },
    validate: { schema: updateAttendanceSchema },
    audit: "attendance",
    apiPath: "/attendance/:id",
  },
  DELETE: {
    controller: attendanceController.deleteAttendance,
    auth: true,
    permission: { resource: "attendance", action: "delete" },
    audit: "attendance",
    apiPath: "/attendance/:id",
  },
});
