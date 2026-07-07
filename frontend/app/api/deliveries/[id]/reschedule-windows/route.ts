import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as dispatchController from "@/lib/server/controllers/dispatch-engine.controller";
import { z } from "zod";

export const { POST } = apiRoutes({
  POST: {
    controller: dispatchController.rescheduleWindows,
    auth: true,
    permission: { resource: "delivery", action: "view" },
    validate: {
      schema: z.object({ earliestAcceptableAt: z.string().optional() }),
    },
    apiPath: "/deliveries/:id/reschedule-windows",
  },
});
