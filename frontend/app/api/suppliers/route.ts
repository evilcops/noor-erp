import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as supplierController from "@/lib/server/controllers/supplier.controller";
import { createSupplierSchema } from "@/lib/server/schemas/supplier.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: supplierController.listSuppliers,
    auth: true,
    permission: { resource: "supplier", action: "view" },
    audit: "supplier",
    apiPath: "/suppliers",
  },
  POST: {
    controller: supplierController.createSupplier,
    auth: true,
    permission: { resource: "supplier", action: "create" },
    validate: { schema: createSupplierSchema },
    audit: "supplier",
    apiPath: "/suppliers",
  },
});
