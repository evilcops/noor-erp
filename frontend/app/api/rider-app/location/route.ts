import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as deliveryController from "@/lib/server/controllers/delivery.controller";
import { riderLocationSchema } from "@/lib/server/schemas/delivery.schema";

export const { POST } = apiRoutes({
  POST: {
    controller: deliveryController.updateMyRiderLocation,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    validate: { schema: riderLocationSchema },
    apiPath: "/rider-app/location",
  },
});
