import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/health", asyncHandler(adminController.healthCheck));
router.get("/system-info", authenticate, asyncHandler(adminController.systemInfo));
router.get(
  "/audit-logs",
  authenticate,
  requirePermission("audit", "view"),
  asyncHandler(adminController.auditLogs)
);

export default router;
