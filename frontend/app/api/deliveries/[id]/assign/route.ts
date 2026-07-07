import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";
import { assignDeliverySchema } from "@/lib/server/schemas/delivery.schema";

export const POST = apiRoute({
  controller: deliveryController.assignDelivery,
  auth: true,
  permission: { resource: "delivery", action: "assign" },
  validate: { schema: assignDeliverySchema },
  apiPath: "/deliveries/:id/assign",
});
