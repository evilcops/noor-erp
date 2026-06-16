import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as authController from "@/lib/server/controllers/auth.controller";
import { registerSchema } from "@/lib/server/schemas/auth.schema";

export const POST = apiRoute({
  controller: authController.register,
  validate: { schema: registerSchema },
  audit: "user",
  apiPath: "/auth/register",
});
