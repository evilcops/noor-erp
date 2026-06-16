import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as performanceController from "@/lib/server/controllers/performance.controller";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: performanceController.listReviews,
    auth: true,
    permission: { resource: "performance", action: "view" },
    audit: "performance",
    apiPath: "/performance/reviews",
  },
  POST: {
    controller: performanceController.createReview,
    auth: true,
    permission: { resource: "performance", action: "create" },
    audit: "performance",
    apiPath: "/performance/reviews",
  },
});
