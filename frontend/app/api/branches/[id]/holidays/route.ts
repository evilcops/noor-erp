import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as branchController from "@/lib/server/controllers/branch.controller";
import { branchHolidaySchema } from "@/lib/server/schemas/branch.schema";

export const POST = apiRoute({
  controller: branchController.addBranchHoliday,
  auth: true,
  permission: { resource: "branch", action: "edit" },
  validate: { schema: branchHolidaySchema },
  audit: "branch",
  apiPath: "/branches/:id/holidays",
});
