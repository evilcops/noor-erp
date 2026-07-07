import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const { POST } = apiRoutes({
  POST: {
    controller: deliveryController.startRoute,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    apiPath: "/rider-app/route/start",
  },
});
