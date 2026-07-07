import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const POST = apiRoute({
  controller: deliveryController.autoAssignDelivery,
  auth: true,
  permission: { resource: "delivery", action: "assign" },
  audit: "delivery",
  apiPath: "/deliveries/:id/auto-assign",
});
