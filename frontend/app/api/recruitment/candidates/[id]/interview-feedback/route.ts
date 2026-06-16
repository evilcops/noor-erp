import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as recruitmentController from "@/lib/server/controllers/recruitment.controller";

export const POST = apiRoute({
  controller: recruitmentController.interviewFeedback,
  auth: true,
  permission: { resource: "recruitment", action: "edit" },
  audit: "recruitment",
  apiPath: "/recruitment/candidates/:id/interview-feedback",
});
