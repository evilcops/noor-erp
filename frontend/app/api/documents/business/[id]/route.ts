import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/businessDocument.controller";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: ctrl.getBusinessDocument,
    auth: true,
    permission: { resource: "employee", action: "view" },
    audit: "document",
    apiPath: "/documents/business/:id",
  },
  PUT: {
    controller: ctrl.updateBusinessDocument,
    auth: true,
    permission: { resource: "employee", action: "edit" },
    audit: "document",
    apiPath: "/documents/business/:id",
  },
  DELETE: {
    controller: ctrl.deleteBusinessDocument,
    auth: true,
    permission: { resource: "employee", action: "delete" },
    audit: "document",
    apiPath: "/documents/business/:id",
  },
});
