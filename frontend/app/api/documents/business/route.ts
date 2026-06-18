import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/businessDocument.controller";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: ctrl.listBusinessDocuments,
    auth: true,
    permission: { resource: "employee", action: "view" },
    audit: "document",
    apiPath: "/documents/business",
  },
  POST: {
    controller: ctrl.createBusinessDocument,
    auth: true,
    permission: { resource: "employee", action: "edit" },
    audit: "document",
    apiPath: "/documents/business",
  },
});
