import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as notificationController from "@/lib/server/controllers/notification.controller";

export const GET = apiRoute({
  controller: notificationController.listNotifications,
  auth: true,
  permission: { resource: "notification", action: "view" },
  apiPath: "/notifications",
});
