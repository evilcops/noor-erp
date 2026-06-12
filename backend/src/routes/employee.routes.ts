import { Router } from "express";
import * as employeeController from "../controllers/employee.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { requirePermission } from "../middleware/permission.js";
import { upload } from "../middleware/multer.js";
import { validate } from "../middleware/validation.js";
import { createEmployeeSchema, updateEmployeeSchema } from "../schemas/employee.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(auditMiddleware("employee"));

router.get(
  "/documents/expiring",
  requirePermission("employee", "view"),
  asyncHandler(employeeController.getExpiringDocuments)
);
router.post(
  "/",
  requirePermission("employee", "create"),
  validate(createEmployeeSchema),
  asyncHandler(employeeController.createEmployee)
);
router.get("/", requirePermission("employee", "view"), asyncHandler(employeeController.listEmployees));
router.get("/:id", requirePermission("employee", "view"), asyncHandler(employeeController.getEmployee));
router.put(
  "/:id",
  requirePermission("employee", "edit"),
  validate(updateEmployeeSchema),
  asyncHandler(employeeController.updateEmployee)
);
router.delete(
  "/:id",
  requirePermission("employee", "delete"),
  asyncHandler(employeeController.deleteEmployee)
);
router.post(
  "/:id/documents",
  requirePermission("employee", "edit"),
  upload.single("file"),
  asyncHandler(employeeController.uploadDocument)
);
router.delete(
  "/:id/documents/:docId",
  requirePermission("employee", "edit"),
  asyncHandler(employeeController.deleteDocument)
);

export default router;
