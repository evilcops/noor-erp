import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as employeeController from "@/lib/server/controllers/employee.controller";
import { createEmployeeSchema } from "@/lib/server/schemas/employee.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: employeeController.listEmployees,
    auth: true,
    permission: { resource: "employee", action: "view" },
    audit: "employee",
    apiPath: "/employees",
  },
  POST: {
    controller: employeeController.createEmployee,
    auth: true,
    permission: { resource: "employee", action: "create" },
    validate: { schema: createEmployeeSchema },
    audit: "employee",
    apiPath: "/employees",
  },
});
