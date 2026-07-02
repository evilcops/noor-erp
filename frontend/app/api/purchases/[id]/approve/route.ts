import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";

export const POST = apiRoute({
  controller: purchaseController.approvePurchase,
  auth: true,
  permission: { resource: "purchase", action: "approve" },
  audit: "purchase",
  apiPath: "/purchases/:id/approve",
});
