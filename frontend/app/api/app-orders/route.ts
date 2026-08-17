import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as appOrdersController from "@/lib/server/controllers/app-orders.controller";

export const GET = apiRoute({
  controller: appOrdersController.listAppOrders,
  auth: true,
  permission: { resource: "inventory", action: "view" },
  apiPath: "/app-orders",
});
