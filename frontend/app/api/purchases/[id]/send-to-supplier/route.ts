import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";

export const POST = apiRoute({
  controller: purchaseController.sendPurchaseToSupplier,
  auth: true,
  permission: { resource: "purchase", action: "edit" },
  audit: "purchase",
  apiPath: "/purchases/:id/send-to-supplier",
});
