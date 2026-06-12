import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("notification", "view"), asyncHandler(notificationController.listNotifications));
router.put("/read-all", requirePermission("notification", "edit"), asyncHandler(notificationController.markAllRead));
router.put("/:id/read", requirePermission("notification", "edit"), asyncHandler(notificationController.markRead));
router.delete("/:id", requirePermission("notification", "delete"), asyncHandler(notificationController.deleteNotification));

export default router;
