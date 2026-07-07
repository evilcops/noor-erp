import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as dispatchController from "@/lib/server/controllers/dispatch-engine.controller";
import { z } from "zod";

export const { POST } = apiRoutes({
  POST: {
    controller: dispatchController.processStandingOrders,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    validate: {
      schema: z.object({
        branchId: z.string().optional(),
        companyId: z.string().optional(),
      }),
    },
    apiPath: "/dispatch/standing-orders/process",
  },
});
