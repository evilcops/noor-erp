import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as marketingController from "@/lib/server/controllers/marketing.controller";
import { createProductAdSchema } from "@/lib/server/schemas/marketing.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: marketingController.listAds,
    auth: true,
    permission: { resource: "product", action: "view" },
    apiPath: "/marketing/ads",
  },
  POST: {
    controller: marketingController.createProductAd,
    auth: true,
    permission: { resource: "product", action: "create" },
    validate: { schema: createProductAdSchema },
    audit: "product",
    apiPath: "/marketing/ads",
  },
});
