import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as branchController from "@/lib/server/controllers/branch.controller";

export const POST = apiRoute({
  controller: branchController.regenerateBranchClusters,
  auth: true,
  permission: { resource: "branch", action: "edit" },
  apiPath: "/branches/:id/regenerate-clusters",
});
