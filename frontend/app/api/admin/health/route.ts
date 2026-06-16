import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as adminController from "@/lib/server/controllers/admin.controller";

export const GET = apiRoute({
  controller: adminController.healthCheck,
  apiPath: "/admin/health",
});
