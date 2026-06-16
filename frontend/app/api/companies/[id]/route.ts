import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as companyController from "@/lib/server/controllers/company.controller";
import { updateCompanySchema } from "@/lib/server/schemas/company.schema";

export const { GET, PUT, DELETE } = apiRoutes({
  GET: {
    controller: companyController.getCompany,
    auth: true,
    permission: { resource: "company", action: "view" },
    audit: "company",
    apiPath: "/companies/:id",
  },
  PUT: {
    controller: companyController.updateCompany,
    auth: true,
    permission: { resource: "company", action: "edit" },
    validate: { schema: updateCompanySchema },
    audit: "company",
    apiPath: "/companies/:id",
  },
  DELETE: {
    controller: companyController.deleteCompany,
    auth: true,
    permission: { resource: "company", action: "delete" },
    audit: "company",
    apiPath: "/companies/:id",
  },
});
