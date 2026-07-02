import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as supplierController from "@/lib/server/controllers/supplier.controller";
import { updateSupplierSchema } from "@/lib/server/schemas/supplier.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: supplierController.getSupplier,
    auth: true,
    permission: { resource: "supplier", action: "view" },
    audit: "supplier",
    apiPath: "/suppliers/:id",
  },
  PUT: {
    controller: supplierController.updateSupplier,
    auth: true,
    permission: { resource: "supplier", action: "edit" },
    validate: { schema: updateSupplierSchema },
    audit: "supplier",
    apiPath: "/suppliers/:id",
  },
  DELETE: {
    controller: supplierController.deleteSupplier,
    auth: true,
    permission: { resource: "supplier", action: "delete" },
    audit: "supplier",
    apiPath: "/suppliers/:id",
  },
});
