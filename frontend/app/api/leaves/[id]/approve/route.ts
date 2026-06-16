import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as leaveController from "@/lib/server/controllers/leave.controller";

export const PUT = apiRoute({
  controller: leaveController.approveLeave,
  auth: true,
  permission: { resource: "leave", action: "approve" },
  audit: "leave",
  apiPath: "/leaves/:id/approve",
});
