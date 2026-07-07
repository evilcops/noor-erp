import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";
import { optimizeRouteSchema } from "@/lib/server/schemas/delivery.schema";

export const POST = apiRoute({
  controller: deliveryController.optimizeRiderRoute,
  auth: true,
  permission: { resource: "delivery", action: "assign" },
  validate: { schema: optimizeRouteSchema },
  apiPath: "/deliveries/optimize-route",
});
