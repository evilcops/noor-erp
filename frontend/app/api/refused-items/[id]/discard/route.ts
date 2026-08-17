import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as refusedItemController from "@/lib/server/controllers/refused-item.controller";

export const POST = apiRoute({
  controller: refusedItemController.discardRefusedItemHandler,
  auth: true,
  permission: { resource: "inventory", action: "edit" },
  apiPath: "/refused-items/:id/discard",
});
