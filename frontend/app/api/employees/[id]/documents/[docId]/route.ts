import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as employeeController from "@/lib/server/controllers/employee.controller";

export const DELETE = apiRoute({
  controller: employeeController.deleteDocument,
  auth: true,
  permission: { resource: "employee", action: "edit" },
  audit: "employee",
  apiPath: "/employees/:id/documents/:docId",
});
