import { Router } from "express";
import * as recruitmentController from "../controllers/recruitment.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(auditMiddleware("recruitment"));

router.post(
  "/candidates",
  requirePermission("recruitment", "create"),
  asyncHandler(recruitmentController.addCandidate)
);
router.get(
  "/candidates",
  requirePermission("recruitment", "view"),
  asyncHandler(recruitmentController.listCandidates)
);
router.get(
  "/candidates/:id",
  requirePermission("recruitment", "view"),
  asyncHandler(recruitmentController.getCandidate)
);
router.put(
  "/candidates/:id",
  requirePermission("recruitment", "edit"),
  asyncHandler(recruitmentController.updateCandidate)
);
router.put(
  "/candidates/:id/status",
  requirePermission("recruitment", "edit"),
  asyncHandler(recruitmentController.updateCandidateStatus)
);
router.post(
  "/candidates/:id/convert-to-employee",
  requirePermission("recruitment", "create"),
  asyncHandler(recruitmentController.convertToEmployee)
);
router.post(
  "/candidates/:id/schedule-interview",
  requirePermission("recruitment", "edit"),
  asyncHandler(recruitmentController.scheduleInterview)
);
router.post(
  "/candidates/:id/interview-feedback",
  requirePermission("recruitment", "edit"),
  asyncHandler(recruitmentController.interviewFeedback)
);

export default router;
