import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as notificationController from "@/lib/server/controllers/notification.controller";

export const DELETE = apiRoute({
  controller: notificationController.deleteNotification,
  auth: true,
  permission: { resource: "notification", action: "delete" },
  apiPath: "/notifications/:id",
});
