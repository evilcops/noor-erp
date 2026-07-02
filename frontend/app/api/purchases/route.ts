import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";
import { createPurchaseSchema } from "@/lib/server/schemas/purchase.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: purchaseController.listPurchases,
    auth: true,
    permission: { resource: "purchase", action: "view" },
    audit: "purchase",
    apiPath: "/purchases",
  },
  POST: {
    controller: purchaseController.createPurchase,
    auth: true,
    permission: { resource: "purchase", action: "create" },
    validate: { schema: createPurchaseSchema },
    audit: "purchase",
    apiPath: "/purchases",
  },
});
