import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as marketingController from "@/lib/server/controllers/marketing.controller";

/** GET — verify OPENART_SESSION_COOKIE / OPENART_API_TOKEN from .env */
export const GET = apiRoute({
  controller: marketingController.openArtStatus,
  auth: true,
  permission: { resource: "product", action: "view" },
  apiPath: "/marketing/openart/status",
});
