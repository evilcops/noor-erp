import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/branchDocument.controller";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: ctrl.getBranchDocument,
    auth: true,
    permission: { resource: "employee", action: "view" },
    audit: "document",
    apiPath: "/documents/branch/:id",
  },
  PUT: {
    controller: ctrl.updateBranchDocument,
    auth: true,
    permission: { resource: "employee", action: "edit" },
    audit: "document",
    apiPath: "/documents/branch/:id",
  },
  DELETE: {
    controller: ctrl.deleteBranchDocument,
    auth: true,
    permission: { resource: "employee", action: "delete" },
    audit: "document",
    apiPath: "/documents/branch/:id",
  },
});
