import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as refusedItemController from "@/lib/server/controllers/refused-item.controller";

export const GET = apiRoute({
  controller: refusedItemController.listRefusedItems,
  auth: true,
  permission: { resource: "inventory", action: "view" },
  apiPath: "/refused-items",
});
