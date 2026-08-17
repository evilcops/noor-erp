import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";

export const GET = apiRoute({
  controller: storefrontController.listStoreBranches,
  auth: false,
  apiPath: "/store/branches",
});
