import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/businessDocument.controller";

export const GET = apiRoute({
  controller: ctrl.getExpiringBusinessDocuments,
  auth: true,
  permission: { resource: "employee", action: "view" },
  apiPath: "/documents/business/expiring",
});
