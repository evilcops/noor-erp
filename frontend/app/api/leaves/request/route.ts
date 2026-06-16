import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as leaveController from "@/lib/server/controllers/leave.controller";
import { leaveRequestSchema } from "@/lib/server/schemas/leave.schema";

export const POST = apiRoute({
  controller: leaveController.requestLeave,
  auth: true,
  permission: { resource: "leave", action: "create" },
  validate: { schema: leaveRequestSchema },
  audit: "leave",
  apiPath: "/leaves/request",
});
