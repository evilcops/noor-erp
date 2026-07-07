import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as purchaseController from "@/lib/server/controllers/purchase.controller";
import { amendPurchaseSchema } from "@/lib/server/schemas/purchase.schema";

export const POST = apiRoute({
  controller: purchaseController.amendPurchaseAfterOrder,
  auth: true,
  permission: { resource: "purchase", action: "edit" },
  validate: { schema: amendPurchaseSchema },
  audit: "purchase",
  apiPath: "/purchases/:id/amend",
});
