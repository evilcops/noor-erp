import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as attendanceController from "@/lib/server/controllers/attendance.controller";
import { missedCheckoutSchema } from "@/lib/server/schemas/attendance.schema";

export const POST = apiRoute({
  controller: attendanceController.reportMissedCheckout,
  auth: true,
  permission: { resource: "attendance", action: "create" },
  validate: { schema: missedCheckoutSchema },
  audit: "attendance",
  apiPath: "/attendance/:id/missed-checkout",
});
