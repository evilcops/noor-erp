import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const POST = apiRoute({
  controller: deliveryController.sendDeliveryWhatsApp,
  auth: true,
  permission: { resource: "delivery", action: "assign" },
  apiPath: "/deliveries/:id/send-whatsapp",
});
