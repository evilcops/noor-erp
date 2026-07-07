import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as dispatchController from "@/lib/server/controllers/dispatch-engine.controller";

export const GET = apiRoute({
  controller: dispatchController.getWarehouseQueue,
  auth: true,
  permission: { resource: "delivery", action: "assign" },
  apiPath: "/dispatch/queue",
});
