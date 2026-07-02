import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as productController from "@/lib/server/controllers/product.controller";

export const POST = apiRoute({
  controller: productController.uploadProductImage,
  auth: true,
  permission: { resource: "product", action: "edit" },
  audit: "product",
  upload: true,
  apiPath: "/products/:id/images",
});
