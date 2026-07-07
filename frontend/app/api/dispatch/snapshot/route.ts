import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as dispatchController from "@/lib/server/controllers/dispatch-engine.controller";

export const { GET } = apiRoutes({
  GET: {
    controller: dispatchController.getFleetSnapshot,
    auth: true,
    permission: { resource: "delivery", action: "view" },
    apiPath: "/dispatch/snapshot",
  },
});
