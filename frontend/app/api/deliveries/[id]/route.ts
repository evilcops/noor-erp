import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";
import { updateDeliveryStatusSchema } from "@/lib/server/schemas/delivery.schema";

export const { GET, PATCH } = apiRoutes({
  GET: {
    controller: deliveryController.getDelivery,
    auth: true,
    permission: { resource: "delivery", action: "view" },
    apiPath: "/deliveries/:id",
  },
  PATCH: {
    controller: deliveryController.updateDeliveryStatus,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    validate: { schema: updateDeliveryStatusSchema },
    apiPath: "/deliveries/:id",
  },
});
