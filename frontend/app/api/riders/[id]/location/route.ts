import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as riderController from "@/lib/server/controllers/rider.controller";
import { riderLocationSchema } from "@/lib/server/schemas/delivery.schema";

export const POST = apiRoute({
  controller: riderController.updateRiderLocation,
  auth: true,
  permission: { resource: "rider", action: "edit" },
  validate: { schema: riderLocationSchema },
  apiPath: "/riders/:id/location",
});
