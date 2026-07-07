import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as riderController from "@/lib/server/controllers/rider.controller";

export const { GET } = apiRoutes({
  GET: {
    controller: riderController.listRiders,
    auth: true,
    permission: { resource: "rider", action: "view" },
    apiPath: "/riders",
  },
});
