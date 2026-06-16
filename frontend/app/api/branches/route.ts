import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as branchController from "@/lib/server/controllers/branch.controller";
import { createBranchSchema } from "@/lib/server/schemas/branch.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: branchController.listBranches,
    auth: true,
    permission: { resource: "branch", action: "view" },
    audit: "branch",
    apiPath: "/branches",
  },
  POST: {
    controller: branchController.createBranch,
    auth: true,
    permission: { resource: "branch", action: "create" },
    validate: { schema: createBranchSchema },
    audit: "branch",
    apiPath: "/branches",
  },
});
