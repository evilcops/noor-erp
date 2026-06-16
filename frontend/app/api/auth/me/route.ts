import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as authController from "@/lib/server/controllers/auth.controller";

export const GET = apiRoute({
  controller: authController.me,
  auth: true,
  apiPath: "/auth/me",
});
