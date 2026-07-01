import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as leaveController from "@/lib/server/controllers/leave.controller";

export const POST = apiRoute({
  controller: leaveController.cancelOwnLeave,
  auth: true,
  permission: { resource: "leave", action: "create" },
  audit: "leave",
  apiPath: "/leaves/:id/cancel",
});
