import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as userController from "@/lib/server/controllers/user.controller";

export const GET = apiRoute({
  controller: userController.roleDefinitionsHandler,
  auth: true,
  permission: { resource: "user", action: "view" },
  apiPath: "/permissions/roles",
});
