import { Router } from "express";
import * as companyController from "../controllers/company.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { requirePermission } from "../middleware/permission.js";
import { validate } from "../middleware/validation.js";
import { createCompanySchema, updateCompanySchema } from "../schemas/company.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(auditMiddleware("company"));

router.post(
  "/",
  requirePermission("company", "create"),
  validate(createCompanySchema),
  asyncHandler(companyController.createCompany)
);
router.get("/", requirePermission("company", "view"), asyncHandler(companyController.listCompanies));
router.get("/:id", requirePermission("company", "view"), asyncHandler(companyController.getCompany));
router.put(
  "/:id",
  requirePermission("company", "edit"),
  validate(updateCompanySchema),
  asyncHandler(companyController.updateCompany)
);
router.delete(
  "/:id",
  requirePermission("company", "delete"),
  asyncHandler(companyController.deleteCompany)
);

export default router;
