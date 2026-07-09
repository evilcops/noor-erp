import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as devController from "@/lib/server/controllers/dev.controller";

// Development-only runtime rider GPS simulation along planned routes.
// Blocked in production by the controller.
export const POST = apiRoute({
  controller: devController.simulateRiderGps,
  auth: false,
  apiPath: "/dev/simulate-rider-gps",
});
