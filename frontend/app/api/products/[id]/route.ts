import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as productController from "@/lib/server/controllers/product.controller";
import { updateProductSchema } from "@/lib/server/schemas/product.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: productController.getProduct,
    auth: true,
    permission: { resource: "product", action: "view" },
    audit: "product",
    apiPath: "/products/:id",
  },
  PUT: {
    controller: productController.updateProduct,
    auth: true,
    permission: { resource: "product", action: "edit" },
    validate: { schema: updateProductSchema },
    audit: "product",
    apiPath: "/products/:id",
  },
  DELETE: {
    controller: productController.deleteProduct,
    auth: true,
    permission: { resource: "product", action: "delete" },
    audit: "product",
    apiPath: "/products/:id",
  },
});
