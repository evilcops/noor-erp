import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";
import { z } from "zod";

export const PATCH = apiRoute({
  controller: deliveryController.updateWarehouseStatus,
  auth: true,
  permission: { resource: "delivery", action: "edit" },
  validate: {
    schema: z.object({
      status: z.enum([
        "order_confirmed",
        "picking",
        "packing",
        "ready_for_dispatch",
        "waiting_for_rider",
        "loaded",
        "dispatched",
      ]),
    }),
  },
  apiPath: "/deliveries/:id/warehouse-status",
});
