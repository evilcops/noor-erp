import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as riderController from "@/lib/server/controllers/rider.controller";

export const { GET, PUT } = apiRoutes({
  GET: {
    controller: riderController.getRider,
    auth: true,
    permission: { resource: "rider", action: "view" },
    apiPath: "/riders/:id",
  },
  PUT: {
    controller: riderController.updateRider,
    auth: true,
    permission: { resource: "rider", action: "edit" },
    apiPath: "/riders/:id",
  },
});
