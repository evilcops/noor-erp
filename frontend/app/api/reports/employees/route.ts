import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as reportController from "@/lib/server/controllers/report.controller";

export const GET = apiRoute({
  controller: reportController.employeeReport,
  auth: true,
  permission: { resource: "report", action: "view" },
  apiPath: "/reports/employees",
});
