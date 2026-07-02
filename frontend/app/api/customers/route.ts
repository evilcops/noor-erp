import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as customerController from "@/lib/server/controllers/customer.controller";

export const { GET } = apiRoutes({
  GET: {
    controller: customerController.listCustomers,
    auth: true,
    permission: { resource: "customer", action: "view" },
    audit: "customer",
    apiPath: "/customers",
  },
});
