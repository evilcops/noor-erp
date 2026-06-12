import { Router } from "express";
import * as reportController from "../controllers/report.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

router.get("/employees", requirePermission("report", "view"), asyncHandler(reportController.employeeReport));
router.get("/attendance", requirePermission("report", "view"), asyncHandler(reportController.attendanceReport));
router.get("/leave", requirePermission("report", "view"), asyncHandler(reportController.leaveReport));
router.get("/recruitment", requirePermission("report", "view"), asyncHandler(reportController.recruitmentReport));
router.get("/performance", requirePermission("report", "view"), asyncHandler(reportController.performanceReport));

export default router;
