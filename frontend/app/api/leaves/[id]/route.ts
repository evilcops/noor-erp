import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as leaveController from "@/lib/server/controllers/leave.controller";
import { updateLeaveSchema } from "@/lib/server/schemas/leave.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: leaveController.getLeave,
    auth: true,
    permission: { resource: "leave", action: "view" },
    audit: "leave",
    apiPath: "/leaves/:id",
  },
  PUT: {
    controller: leaveController.updateLeave,
    auth: true,
    permission: { resource: "leave", action: "edit" },
    validate: { schema: updateLeaveSchema },
    audit: "leave",
    apiPath: "/leaves/:id",
  },
  DELETE: {
    controller: leaveController.deleteLeave,
    auth: true,
    permission: { resource: "leave", action: "delete" },
    audit: "leave",
    apiPath: "/leaves/:id",
  },
});
