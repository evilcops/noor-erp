import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as performanceController from "@/lib/server/controllers/performance.controller";

export const PUT = apiRoute({
  controller: performanceController.submitReview,
  auth: true,
  permission: { resource: "performance", action: "edit" },
  audit: "performance",
  apiPath: "/performance/reviews/:id/submit",
});
