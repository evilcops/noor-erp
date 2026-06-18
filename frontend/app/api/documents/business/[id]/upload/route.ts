import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/businessDocument.controller";

export const POST = apiRoute({
  controller: ctrl.uploadBusinessDocumentFile,
  auth: true,
  permission: { resource: "employee", action: "edit" },
  upload: true,
  audit: "document",
  apiPath: "/documents/business/:id/upload",
});
