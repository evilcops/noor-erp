import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as appOrdersController from "@/lib/server/controllers/app-orders.controller";

export const POST = apiRoute({
  controller: appOrdersController.assignAppOrderRider,
  auth: true,
  permission: { resource: "delivery", action: "assign" },
  apiPath: "/app-orders/:id/assign-rider",
});
