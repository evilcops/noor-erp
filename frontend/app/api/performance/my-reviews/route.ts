import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as performanceController from "@/lib/server/controllers/performance.controller";

export const GET = apiRoute({
  controller: performanceController.getMyReviews,
  auth: true,
  permission: { resource: "performance", action: "view" },
  audit: "performance",
  apiPath: "/performance/my-reviews",
});
