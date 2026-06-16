import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as authController from "@/lib/server/controllers/auth.controller";
import { forgotPasswordSchema } from "@/lib/server/schemas/auth.schema";

export const POST = apiRoute({
  controller: authController.forgotPassword,
  validate: { schema: forgotPasswordSchema },
  apiPath: "/auth/forgot-password",
});
