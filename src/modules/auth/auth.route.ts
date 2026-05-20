import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate";
import {
  forgotPasswordLimiter,
  loginLimiter,
  registerLimiter,
} from "../../middlewares/rateLimiter";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import authController from "./auth.controller";
import {
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from "./auth.validation";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  validate(validateRegister),
  asyncHandler(authController.register)
);

router.post(
  "/login",
  loginLimiter,
  validate(validateLogin),
  asyncHandler(authController.login)
);

router.post("/refresh", asyncHandler(authController.refresh));

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(validateForgotPassword),
  asyncHandler(authController.forgotPassword)
);

router.post(
  "/reset-password",
  validate(validateResetPassword),
  asyncHandler(authController.resetPassword)
);

router.post("/logout", asyncHandler(authController.logout));

router.get("/me", authenticate, asyncHandler(authController.me));

export default router;
