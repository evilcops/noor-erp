import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as employeeController from "@/lib/server/controllers/employee.controller";

export const POST = apiRoute({
  controller: employeeController.uploadDocument,
  auth: true,
  permission: { resource: "employee", action: "edit" },
  audit: "employee",
  upload: true,
  apiPath: "/employees/:id/documents",
});
