import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/audit.js";
import { validate } from "../middleware/validation.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", validate(registerSchema), auditMiddleware("user"), asyncHandler(authController.register));
router.post("/login", validate(loginSchema), asyncHandler(authController.login));
router.post("/logout", authenticate, asyncHandler(authController.logout));
router.post("/refresh", validate(refreshSchema), asyncHandler(authController.refresh));
router.get("/me", authenticate, asyncHandler(authController.me));
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  auditMiddleware("user"),
  asyncHandler(authController.changePasswordHandler)
);
router.post("/forgot-password", validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post("/reset-password", validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

export default router;
