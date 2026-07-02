import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";

export const POST = apiRoute({
  controller: purchaseController.submitPurchase,
  auth: true,
  permission: { resource: "purchase", action: "edit" },
  audit: "purchase",
  apiPath: "/purchases/:id/submit",
});
