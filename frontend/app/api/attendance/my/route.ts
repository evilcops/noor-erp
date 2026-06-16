import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";

export const GET = apiRoute({
  controller: attendanceController.getMyAttendance,
  auth: true,
  permission: { resource: "attendance", action: "view" },
  audit: "attendance",
  apiPath: "/attendance/my",
});
