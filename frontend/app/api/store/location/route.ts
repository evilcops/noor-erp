import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as storefrontController from "@/lib/server/controllers/storefront.controller";
import { storeLocationSchema } from "@/lib/server/schemas/store.schema";

export const POST = apiRoute({
  controller: storefrontController.storeResolveLocation,
  auth: false,
  validate: { schema: storeLocationSchema },
  apiPath: "/store/location",
});

export const PATCH = apiRoute({
  controller: storefrontController.storeUpdateLocation,
  auth: true,
  validate: { schema: storeLocationSchema },
  apiPath: "/store/location",
});
