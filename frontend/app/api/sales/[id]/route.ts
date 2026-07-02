import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as customerController from "@/lib/server/controllers/customer.controller";

export const GET = apiRoute({
  controller: customerController.getSale,
  auth: true,
  permission: { resource: "customer", action: "view" },
  audit: "customer",
  apiPath: "/sales/:id",
});
