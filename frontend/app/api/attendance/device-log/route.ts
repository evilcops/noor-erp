import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { deviceLogSchema } from "@/lib/server/schemas/attendance.schema";

/**
 * Hardware SDK webhook endpoint.
 * Authenticated via X-Device-Key header (not JWT).
 * Set DEVICE_SECRET_KEY environment variable to secure this endpoint.
 */
export const POST = apiRoute({
  controller: attendanceController.deviceLog,
  auth: false,
  validate: { schema: deviceLogSchema },
  apiPath: "/attendance/device-log",
});
