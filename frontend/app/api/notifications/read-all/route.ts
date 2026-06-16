import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as notificationController from "@/lib/server/controllers/notification.controller";

export const PUT = apiRoute({
  controller: notificationController.markAllRead,
  auth: true,
  permission: { resource: "notification", action: "edit" },
  apiPath: "/notifications/read-all",
});
