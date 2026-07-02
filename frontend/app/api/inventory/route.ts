import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as inventoryController from "@/lib/server/controllers/inventory.controller";
import { stockAdjustmentSchema } from "@/lib/server/schemas/product.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: inventoryController.listStockLevels,
    auth: true,
    permission: { resource: "inventory", action: "view" },
    audit: "inventory",
    apiPath: "/inventory",
  },
  POST: {
    controller: inventoryController.adjustStock,
    auth: true,
    permission: { resource: "inventory", action: "edit" },
    validate: { schema: stockAdjustmentSchema },
    audit: "inventory",
    apiPath: "/inventory",
  },
});
