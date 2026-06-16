import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as leaveController from "@/lib/server/controllers/leave.controller";
import { rejectLeaveSchema } from "@/lib/server/schemas/leave.schema";

export const PUT = apiRoute({
  controller: leaveController.rejectLeave,
  auth: true,
  permission: { resource: "leave", action: "approve" },
  validate: { schema: rejectLeaveSchema },
  audit: "leave",
  apiPath: "/leaves/:id/reject",
});
