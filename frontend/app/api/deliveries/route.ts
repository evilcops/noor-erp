import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const { GET } = apiRoutes({
  GET: {
    controller: deliveryController.listDeliveries,
    auth: true,
    permission: { resource: "delivery", action: "view" },
    apiPath: "/deliveries",
  },
});
