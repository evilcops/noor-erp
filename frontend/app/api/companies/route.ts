import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as companyController from "@/lib/server/controllers/company.controller";
import { createCompanySchema } from "@/lib/server/schemas/company.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: companyController.listCompanies,
    auth: true,
    permission: { resource: "company", action: "view" },
    audit: "company",
    apiPath: "/companies",
  },
  POST: {
    controller: companyController.createCompany,
    auth: true,
    permission: { resource: "company", action: "create" },
    validate: { schema: createCompanySchema },
    audit: "company",
    apiPath: "/companies",
  },
});
