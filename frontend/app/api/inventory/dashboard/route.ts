import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as inventoryController from "@/lib/server/controllers/inventory.controller";

export const GET = apiRoute({
  controller: inventoryController.getInventoryDashboard,
  auth: true,
  permission: { resource: "inventory", action: "view" },
  apiPath: "/inventory/dashboard",
});
