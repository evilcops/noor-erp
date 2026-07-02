import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as inventoryController from "@/lib/server/controllers/inventory.controller";

export const GET = apiRoute({
  controller: inventoryController.listMovements,
  auth: true,
  permission: { resource: "inventory", action: "view" },
  audit: "inventory",
  apiPath: "/inventory/movements",
});
