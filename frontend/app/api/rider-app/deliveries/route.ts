import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const { GET } = apiRoutes({
  GET: {
    controller: deliveryController.getMyDeliveries,
    auth: true,
    permission: { resource: "delivery", action: "view" },
    apiPath: "/rider-app/deliveries",
  },
});
