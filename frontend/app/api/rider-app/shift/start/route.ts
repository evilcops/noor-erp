import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const { POST } = apiRoutes({
  POST: {
    controller: deliveryController.startShift,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    apiPath: "/rider-app/shift/start",
  },
});
