import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as customerController from "@/lib/server/controllers/customer.controller";
import { updateCustomerSchema } from "@/lib/server/schemas/customer.schema";

export const { GET, PATCH, DELETE } = apiRoutes({
  GET: {
    controller: customerController.getCustomer,
    auth: true,
    permission: { resource: "customer", action: "view" },
    audit: "customer",
    apiPath: "/customers/:id",
  },
  PATCH: {
    controller: customerController.updateCustomer,
    auth: true,
    permission: { resource: "customer", action: "edit" },
    validate: { schema: updateCustomerSchema },
    audit: "customer",
    apiPath: "/customers/:id",
  },
  DELETE: {
    controller: customerController.deleteCustomer,
    auth: true,
    permission: { resource: "customer", action: "delete" },
    audit: "customer",
    apiPath: "/customers/:id",
  },
});
