import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as productController from "@/lib/server/controllers/product.controller";
import { createProductSchema } from "@/lib/server/schemas/product.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: productController.listProducts,
    auth: true,
    permission: { resource: "product", action: "view" },
    audit: "product",
    apiPath: "/products",
  },
  POST: {
    controller: productController.createProduct,
    auth: true,
    permission: { resource: "product", action: "create" },
    validate: { schema: createProductSchema },
    audit: "product",
    apiPath: "/products",
  },
});
