import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as geocodeController from "@/lib/server/controllers/geocode.controller";

export const GET = apiRoute({
  controller: geocodeController.geocodeSearch,
  auth: true,
  apiPath: "/geocode/search",
});
