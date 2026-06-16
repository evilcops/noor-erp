import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as authController from "@/lib/server/controllers/auth.controller";

export const POST = apiRoute({
  controller: authController.logout,
  auth: true,
  apiPath: "/auth/logout",
});
