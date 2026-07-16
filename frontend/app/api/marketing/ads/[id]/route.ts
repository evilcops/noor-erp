import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as marketingController from "@/lib/server/controllers/marketing.controller";

export const { GET } = apiRoutes({
  GET: {
    controller: marketingController.getAd,
    auth: true,
    permission: { resource: "product", action: "view" },
    apiPath: "/marketing/ads/:id",
  },
});
