import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as productController from "@/lib/server/controllers/product.controller";

export const GET = apiRoute({
  controller: productController.listCategories,
  auth: true,
  permission: { resource: "product", action: "view" },
  apiPath: "/products/categories",
});
