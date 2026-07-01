import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as userController from "@/lib/server/controllers/user.controller";
import { updateUserSchema } from "@/lib/server/schemas/user.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: userController.getUserHandler,
    auth: true,
    permission: { resource: "user", action: "view" },
    audit: "user",
    apiPath: "/users/:id",
  },
  PUT: {
    controller: userController.updateUserHandler,
    auth: true,
    permission: { resource: "user", action: "edit" },
    validate: { schema: updateUserSchema },
    audit: "user",
    apiPath: "/users/:id",
  },
  DELETE: {
    controller: userController.deleteUserHandler,
    auth: true,
    permission: { resource: "user", action: "delete" },
    audit: "user",
    apiPath: "/users/:id",
  },
});
