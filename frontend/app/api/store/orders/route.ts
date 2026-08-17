import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";

export const GET = apiRoute({
  controller: storefrontController.listStoreOrders,
  auth: true,
  apiPath: "/store/orders",
});
