import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";
import { updatePurchaseSchema } from "@/lib/server/schemas/purchase.schema";

export const { GET, PUT } = apiRoutes({
  GET: {
    controller: purchaseController.getPurchase,
    auth: true,
    permission: { resource: "purchase", action: "view" },
    audit: "purchase",
    apiPath: "/purchases/:id",
  },
  PUT: {
    controller: purchaseController.updatePurchase,
    auth: true,
    permission: { resource: "purchase", action: "edit" },
    validate: { schema: updatePurchaseSchema },
    audit: "purchase",
    apiPath: "/purchases/:id",
  },
});
