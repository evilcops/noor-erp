import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";

export const POST = apiRoute({
  controller: purchaseController.cancelPurchase,
  auth: true,
  permission: { resource: "purchase", action: "delete" },
  audit: "purchase",
  apiPath: "/purchases/:id/cancel",
});
