import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as customerController from "@/lib/server/controllers/customer.controller";
import { createCustomerSchema } from "@/lib/server/schemas/customer.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: customerController.listCustomers,
    auth: true,
    permission: { resource: "customer", action: "view" },
    audit: "customer",
    apiPath: "/customers",
  },
  POST: {
    controller: customerController.createCustomer,
    auth: true,
    permission: { resource: "customer", action: "create" },
    validate: { schema: createCustomerSchema },
    audit: "customer",
    apiPath: "/customers",
  },
});
