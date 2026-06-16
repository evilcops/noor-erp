import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as recruitmentController from "@/lib/server/controllers/recruitment.controller";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: recruitmentController.listCandidates,
    auth: true,
    permission: { resource: "recruitment", action: "view" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates",
  },
  POST: {
    controller: recruitmentController.addCandidate,
    auth: true,
    permission: { resource: "recruitment", action: "create" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates",
  },
});
