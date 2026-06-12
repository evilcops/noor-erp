import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { requirePermission } from "../middleware/permission.js";
import { validate } from "../middleware/validation.js";
import {
  approveCorrectionSchema,
  checkInSchema,
  checkOutSchema,
  correctionRequestSchema,
} from "../schemas/attendance.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(auditMiddleware("attendance"));

router.post(
  "/check-in",
  requirePermission("attendance", "create"),
  validate(checkInSchema),
  asyncHandler(attendanceController.checkIn)
);
router.post(
  "/check-out",
  requirePermission("attendance", "create"),
  validate(checkOutSchema),
  asyncHandler(attendanceController.checkOut)
);
router.get("/today", requirePermission("attendance", "view"), asyncHandler(attendanceController.getTodayAttendance));
router.get("/my", requirePermission("attendance", "view"), asyncHandler(attendanceController.getMyAttendance));
router.get("/team", requirePermission("attendance", "view"), asyncHandler(attendanceController.getTeamAttendance));
router.post(
  "/correction-request",
  requirePermission("attendance", "create"),
  validate(correctionRequestSchema),
  asyncHandler(attendanceController.requestCorrection)
);
router.put(
  "/correction/:id/approve",
  requirePermission("attendance", "approve"),
  validate(approveCorrectionSchema),
  asyncHandler(attendanceController.approveCorrection)
);
router.get("/report", requirePermission("attendance", "view"), asyncHandler(attendanceController.attendanceReport));

export default router;
