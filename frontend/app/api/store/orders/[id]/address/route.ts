import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";
import { storeUpdateOrderAddressSchema } from "@/lib/server/schemas/store.schema";

export const PATCH = apiRoute({
  controller: storefrontController.updateStoreOrderAddress,
  auth: true,
  validate: { schema: storeUpdateOrderAddressSchema },
  apiPath: "/store/orders/:id/address",
});
