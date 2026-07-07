import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as riderController from "@/lib/server/controllers/rider.controller";

export const GET = apiRoute({
  controller: riderController.listLiveRiders,
  auth: true,
  permission: { resource: "rider", action: "view" },
  apiPath: "/riders/live",
});
