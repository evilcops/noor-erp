import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as employeeController from "@/lib/server/controllers/employee.controller";

export const GET = apiRoute({
  controller: employeeController.getExpiringDocuments,
  auth: true,
  permission: { resource: "employee", action: "view" },
  audit: "employee",
  apiPath: "/employees/documents/expiring",
});
