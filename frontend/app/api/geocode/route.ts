import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as geocodeController from "@/lib/server/controllers/geocode.controller";

export const { GET } = apiRoutes({
  GET: {
    controller: geocodeController.geocode,
    auth: true,
    apiPath: "/geocode",
  },
});
