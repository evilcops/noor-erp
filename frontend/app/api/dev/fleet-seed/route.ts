import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as devController from "@/lib/server/controllers/dev.controller";

// Development-only helper to create riders + orders and auto-assign them
// through the live dispatch engine. Blocked in production by the controller.
export const POST = apiRoute({
  controller: devController.seedFleet,
  auth: false,
  apiPath: "/dev/fleet-seed",
});
