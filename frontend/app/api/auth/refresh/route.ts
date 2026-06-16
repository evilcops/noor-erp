import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as authController from "@/lib/server/controllers/auth.controller";
import { refreshSchema } from "@/lib/server/schemas/auth.schema";

export const POST = apiRoute({
  controller: authController.refresh,
  validate: { schema: refreshSchema },
  apiPath: "/auth/refresh",
});
