import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/branchDocument.controller";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: ctrl.listBranchDocuments,
    auth: true,
    permission: { resource: "employee", action: "view" },
    audit: "document",
    apiPath: "/documents/branch",
  },
  POST: {
    controller: ctrl.createBranchDocument,
    auth: true,
    permission: { resource: "employee", action: "edit" },
    audit: "document",
    apiPath: "/documents/branch",
  },
});
