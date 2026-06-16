import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as performanceController from "@/lib/server/controllers/performance.controller";

export const PUT = apiRoute({
  controller: performanceController.completeReview,
  auth: true,
  permission: { resource: "performance", action: "approve" },
  audit: "performance",
  apiPath: "/performance/reviews/:id/complete",
});
