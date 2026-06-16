import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as employeeController from "@/lib/server/controllers/employee.controller";
import { updateEmployeeSchema } from "@/lib/server/schemas/employee.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: employeeController.getEmployee,
    auth: true,
    permission: { resource: "employee", action: "view" },
    audit: "employee",
    apiPath: "/employees/:id",
  },
  PUT: {
    controller: employeeController.updateEmployee,
    auth: true,
    permission: { resource: "employee", action: "edit" },
    validate: { schema: updateEmployeeSchema },
    audit: "employee",
    apiPath: "/employees/:id",
  },
  DELETE: {
    controller: employeeController.deleteEmployee,
    auth: true,
    permission: { resource: "employee", action: "delete" },
    audit: "employee",
    apiPath: "/employees/:id",
  },
});
