import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as userController from "@/lib/server/controllers/user.controller";
import { createUserSchema } from "@/lib/server/schemas/user.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: userController.listUsersHandler,
    auth: true,
    permission: { resource: "user", action: "view" },
    audit: "user",
    apiPath: "/users",
  },
  POST: {
    controller: userController.createUserHandler,
    auth: true,
    permission: { resource: "user", action: "create" },
    validate: { schema: createUserSchema },
    audit: "user",
    apiPath: "/users",
  },
});
