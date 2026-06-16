import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as recruitmentController from "@/lib/server/controllers/recruitment.controller";

export const { GET, PUT } = apiRoutes({
  GET: {
    controller: recruitmentController.getCandidate,
    auth: true,
    permission: { resource: "recruitment", action: "view" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates/:id",
  },
  PUT: {
    controller: recruitmentController.updateCandidate,
    auth: true,
    permission: { resource: "recruitment", action: "edit" },
    audit: "recruitment",
    apiPath: "/recruitment/candidates/:id",
  },
});
