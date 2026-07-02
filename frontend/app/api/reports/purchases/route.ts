import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as inventoryController from "@/lib/server/controllers/inventory.controller";

export const GET = apiRoute({
  controller: inventoryController.purchaseReport,
  auth: true,
  permission: { resource: "report", action: "view" },
  apiPath: "/reports/purchases",
});
