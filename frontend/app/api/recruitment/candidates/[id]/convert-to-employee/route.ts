import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as recruitmentController from "@/lib/server/controllers/recruitment.controller";

export const POST = apiRoute({
  controller: recruitmentController.convertToEmployee,
  auth: true,
  permission: { resource: "recruitment", action: "create" },
  audit: "recruitment",
  apiPath: "/recruitment/candidates/:id/convert-to-employee",
});
