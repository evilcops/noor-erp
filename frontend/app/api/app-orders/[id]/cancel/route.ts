import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as appOrdersController from "@/lib/server/controllers/app-orders.controller";

export const POST = apiRoute({
  controller: appOrdersController.cancelAppOrder,
  auth: true,
  permission: { resource: "delivery", action: "edit" },
  apiPath: "/app-orders/:id/cancel",
});
