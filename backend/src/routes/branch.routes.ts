import { Router } from "express";
import * as branchController from "../controllers/branch.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { requirePermission } from "../middleware/permission.js";
import { validate } from "../middleware/validation.js";
import {
  branchHolidaySchema,
  createBranchSchema,
  updateBranchSchema,
} from "../schemas/branch.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.use(auditMiddleware("branch"));

router.post(
  "/",
  requirePermission("branch", "create"),
  validate(createBranchSchema),
  asyncHandler(branchController.createBranch)
);
router.get("/", requirePermission("branch", "view"), asyncHandler(branchController.listBranches));
router.get("/:id", requirePermission("branch", "view"), asyncHandler(branchController.getBranch));
router.put(
  "/:id",
  requirePermission("branch", "edit"),
  validate(updateBranchSchema),
  asyncHandler(branchController.updateBranch)
);
router.delete(
  "/:id",
  requirePermission("branch", "delete"),
  asyncHandler(branchController.deleteBranch)
);
router.post(
  "/:id/holidays",
  requirePermission("branch", "edit"),
  validate(branchHolidaySchema),
  asyncHandler(branchController.addBranchHoliday)
);

export default router;
