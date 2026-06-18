import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/branchDocument.controller";

export const GET = apiRoute({
  controller: ctrl.getExpiringBranchDocuments,
  auth: true,
  permission: { resource: "employee", action: "view" },
  apiPath: "/documents/branch/expiring",
});
