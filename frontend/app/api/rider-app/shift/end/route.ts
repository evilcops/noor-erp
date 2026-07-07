import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";

export const { POST } = apiRoutes({
  POST: {
    controller: deliveryController.endShift,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    apiPath: "/rider-app/shift/end",
  },
});
