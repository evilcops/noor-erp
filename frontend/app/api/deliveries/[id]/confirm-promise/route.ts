import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as dispatchController from "@/lib/server/controllers/dispatch-engine.controller";
import { z } from "zod";

const windowSchema = z.object({
  promisedWindowStart: z.string().min(1),
  promisedWindowEnd: z.string().min(1),
});

export const { POST } = apiRoutes({
  POST: {
    controller: dispatchController.confirmPromise,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    validate: { schema: windowSchema },
    apiPath: "/deliveries/:id/confirm-promise",
  },
});
