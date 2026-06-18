import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as ctrl from "@/lib/server/controllers/branchDocument.controller";

export const POST = apiRoute({
  controller: ctrl.uploadBranchDocumentFile,
  auth: true,
  permission: { resource: "employee", action: "edit" },
  upload: true,
  audit: "document",
  apiPath: "/documents/branch/:id/upload",
});
