import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as leaveController from "@/lib/server/controllers/leave.controller";

export const POST = apiRoute({
  controller: leaveController.uploadLeaveAttachment,
  auth: true,
  permission: { resource: "leave", action: "create" },
  upload: true,
  apiPath: "/leaves/attachment",
});
