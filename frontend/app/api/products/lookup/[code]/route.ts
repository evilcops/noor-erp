import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as productController from "@/lib/server/controllers/product.controller";

export const GET = apiRoute({
  controller: productController.getProductBySku,
  auth: true,
  permission: { resource: "product", action: "view" },
  apiPath: "/products/lookup/:code",
});
