import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";
import { storeCheckoutSchema } from "@/lib/server/schemas/store.schema";

export const POST = apiRoute({
  controller: storefrontController.storeCheckout,
  auth: true,
  validate: { schema: storeCheckoutSchema },
  apiPath: "/store/checkout",
});
