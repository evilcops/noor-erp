import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as devController from "@/lib/server/controllers/dev.controller";

// Development-only helper to empty employees, riders, orders and inventory.
// Blocked in production by the controller.
export const POST = apiRoute({
  controller: devController.resetData,
  auth: false,
  apiPath: "/dev/reset",
});
