import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as adminController from "@/lib/server/controllers/admin.controller";

export const GET = apiRoute({
  controller: adminController.auditLogs,
  auth: true,
  permission: { resource: "audit", action: "view" },
  apiPath: "/admin/audit-logs",
});
