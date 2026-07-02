import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as customerController from "@/lib/server/controllers/customer.controller";
import { recordSaleSchema } from "@/lib/server/schemas/customer.schema";

export const POST = apiRoute({
  controller: customerController.recordSale,
  auth: true,
  permission: { resource: "customer", action: "create" },
  validate: { schema: recordSaleSchema },
  audit: "customer",
  apiPath: "/sales",
});
