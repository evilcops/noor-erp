import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as adminController from "@/lib/server/controllers/admin.controller";

export const GET = apiRoute({
  controller: adminController.systemInfo,
  auth: true,
  apiPath: "/admin/system-info",
});
