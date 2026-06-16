import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as recruitmentController from "@/lib/server/controllers/recruitment.controller";

export const PUT = apiRoute({
  controller: recruitmentController.updateCandidateStatus,
  auth: true,
  permission: { resource: "recruitment", action: "edit" },
  audit: "recruitment",
  apiPath: "/recruitment/candidates/:id/status",
});
