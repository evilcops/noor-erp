import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";
import { storeLoginSchema } from "@/lib/server/schemas/store.schema";

export const POST = apiRoute({
  controller: storefrontController.storeLogin,
  auth: false,
  validate: { schema: storeLoginSchema },
  apiPath: "/store/auth/login",
});
