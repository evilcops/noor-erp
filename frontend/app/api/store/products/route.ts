import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";

export const GET = apiRoute({
  controller: storefrontController.listStoreProducts,
  auth: false,
  apiPath: "/store/products",
});
