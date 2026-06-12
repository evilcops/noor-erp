import { Router } from "express";
import * as performanceController from "../controllers/performance.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(auditMiddleware("performance"));

router.post(
  "/reviews",
  requirePermission("performance", "create"),
  asyncHandler(performanceController.createReview)
);
router.get(
  "/reviews",
  requirePermission("performance", "view"),
  asyncHandler(performanceController.listReviews)
);
router.get(
  "/my-reviews",
  requirePermission("performance", "view"),
  asyncHandler(performanceController.getMyReviews)
);
router.get(
  "/reviews/:id",
  requirePermission("performance", "view"),
  asyncHandler(performanceController.getReview)
);
router.put(
  "/reviews/:id",
  requirePermission("performance", "edit"),
  asyncHandler(performanceController.updateReview)
);
router.put(
  "/reviews/:id/submit",
  requirePermission("performance", "edit"),
  asyncHandler(performanceController.submitReview)
);
router.put(
  "/reviews/:id/complete",
  requirePermission("performance", "approve"),
  asyncHandler(performanceController.completeReview)
);

export default router;
