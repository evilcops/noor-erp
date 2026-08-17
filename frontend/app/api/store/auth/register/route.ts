import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";
import { storeRegisterSchema } from "@/lib/server/schemas/store.schema";

export const POST = apiRoute({
  controller: storefrontController.storeRegister,
  auth: false,
  validate: { schema: storeRegisterSchema },
  apiPath: "/store/auth/register",
});
