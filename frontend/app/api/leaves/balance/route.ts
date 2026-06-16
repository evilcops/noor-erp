import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as leaveController from "@/lib/server/controllers/leave.controller";

export const GET = apiRoute({
  controller: leaveController.getLeaveBalance,
  auth: true,
  permission: { resource: "leave", action: "view" },
  audit: "leave",
  apiPath: "/leaves/balance",
});
