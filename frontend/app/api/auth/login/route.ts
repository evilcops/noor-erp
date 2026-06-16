import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as authController from "@/lib/server/controllers/auth.controller";
import { loginSchema } from "@/lib/server/schemas/auth.schema";

export const POST = apiRoute({
  controller: authController.login,
  validate: { schema: loginSchema },
  apiPath: "/auth/login",
});
