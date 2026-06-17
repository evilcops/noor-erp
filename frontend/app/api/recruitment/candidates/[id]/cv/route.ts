import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as recruitmentController from "@/lib/server/controllers/recruitment.controller";

export const POST = apiRoute({
  controller: recruitmentController.uploadCandidateCV,
  auth: true,
  permission: { resource: "recruitment", action: "edit" },
  audit: "recruitment",
  upload: true,
  apiPath: "/recruitment/candidates/:id/cv",
});
