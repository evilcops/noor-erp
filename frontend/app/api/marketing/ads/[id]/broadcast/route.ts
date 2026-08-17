import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as marketingController from "@/lib/server/controllers/marketing.controller";

export const POST = apiRoute({
  controller: marketingController.broadcastAd,
  auth: true,
  permission: { resource: "product", action: "create" },
  audit: "product",
  apiPath: "/marketing/ads/:id/broadcast",
});
