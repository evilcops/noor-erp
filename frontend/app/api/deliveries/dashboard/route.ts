import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const GET = apiRoute({
  controller: deliveryController.getDispatchDashboard,
  auth: true,
  permission: { resource: "delivery", action: "view" },
  apiPath: "/deliveries/dashboard",
});
