import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as branchController from "@/lib/server/controllers/branch.controller";
import { updateBranchSchema } from "@/lib/server/schemas/branch.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: branchController.getBranch,
    auth: true,
    permission: { resource: "branch", action: "view" },
    audit: "branch",
    apiPath: "/branches/:id",
  },
  PUT: {
    controller: branchController.updateBranch,
    auth: true,
    permission: { resource: "branch", action: "edit" },
    validate: { schema: updateBranchSchema },
    audit: "branch",
    apiPath: "/branches/:id",
  },
  DELETE: {
    controller: branchController.deleteBranch,
    auth: true,
    permission: { resource: "branch", action: "delete" },
    audit: "branch",
    apiPath: "/branches/:id",
  },
});
