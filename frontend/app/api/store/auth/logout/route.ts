import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";

export const POST = apiRoute({
  controller: storefrontController.storeLogout,
  auth: true,
  apiPath: "/store/auth/logout",
});
