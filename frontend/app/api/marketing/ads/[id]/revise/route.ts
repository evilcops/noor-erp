import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as marketingController from "@/lib/server/controllers/marketing.controller";
import { reviseProductAdSchema } from "@/lib/server/schemas/marketing.schema";

export const POST = apiRoute({
  controller: marketingController.reviseAd,
  auth: true,
  permission: { resource: "product", action: "create" },
  validate: { schema: reviseProductAdSchema },
  audit: "product",
  apiPath: "/marketing/ads/:id/revise",
});
