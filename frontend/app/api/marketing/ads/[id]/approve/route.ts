import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as marketingController from "@/lib/server/controllers/marketing.controller";
import { approveProductAdSchema } from "@/lib/server/schemas/marketing.schema";

export const POST = apiRoute({
  controller: marketingController.approveAd,
  auth: true,
  permission: { resource: "product", action: "create" },
  validate: { schema: approveProductAdSchema },
  audit: "product",
  apiPath: "/marketing/ads/:id/approve",
});
