import { Router } from "express";
import * as leaveController from "../controllers/leave.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { requirePermission } from "../middleware/permission.js";
import { validate } from "../middleware/validation.js";
import { leaveRequestSchema, rejectLeaveSchema } from "../schemas/leave.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(auditMiddleware("leave"));

router.post(
  "/request",
  requirePermission("leave", "create"),
  validate(leaveRequestSchema),
  asyncHandler(leaveController.requestLeave)
);
router.get("/", requirePermission("leave", "view"), asyncHandler(leaveController.listLeaves));
router.get("/balance", requirePermission("leave", "view"), asyncHandler(leaveController.getLeaveBalance));
router.get("/calendar", requirePermission("leave", "view"), asyncHandler(leaveController.getLeaveCalendar));
router.get("/:id", requirePermission("leave", "view"), asyncHandler(leaveController.getLeave));
router.put(
  "/:id/approve",
  requirePermission("leave", "approve"),
  asyncHandler(leaveController.approveLeave)
);
router.put(
  "/:id/reject",
  requirePermission("leave", "approve"),
  validate(rejectLeaveSchema),
  asyncHandler(leaveController.rejectLeave)
);

export default router;
