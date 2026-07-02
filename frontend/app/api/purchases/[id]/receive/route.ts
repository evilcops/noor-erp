import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";
import { receivePurchaseSchema } from "@/lib/server/schemas/purchase.schema";

export const POST = apiRoute({
  controller: purchaseController.receivePurchase,
  auth: true,
  permission: { resource: "purchase", action: "edit" },
  validate: { schema: receivePurchaseSchema },
  audit: "purchase",
  apiPath: "/purchases/:id/receive",
});
