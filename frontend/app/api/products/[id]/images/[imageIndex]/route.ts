import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as productController from "@/lib/server/controllers/product.controller";

export const DELETE = apiRoute({
  controller: productController.deleteProductImage,
  auth: true,
  permission: { resource: "product", action: "edit" },
  audit: "product",
  apiPath: "/products/:id/images/:imageIndex",
});
