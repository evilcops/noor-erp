import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as performanceController from "@/lib/server/controllers/performance.controller";

export const { GET, PUT } = apiRoutes({
  GET: {
    controller: performanceController.getReview,
    auth: true,
    permission: { resource: "performance", action: "view" },
    audit: "performance",
    apiPath: "/performance/reviews/:id",
  },
  PUT: {
    controller: performanceController.updateReview,
    auth: true,
    permission: { resource: "performance", action: "edit" },
    audit: "performance",
    apiPath: "/performance/reviews/:id",
  },
});
