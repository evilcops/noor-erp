import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as dispatchController from "@/lib/server/controllers/dispatch-engine.controller";
import { z } from "zod";

export const { POST } = apiRoutes({
  POST: {
    controller: dispatchController.riderBreakdown,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    validate: { schema: z.object({ riderId: z.string().min(1) }) },
    apiPath: "/dispatch/rider-breakdown",
  },
});
