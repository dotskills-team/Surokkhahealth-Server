import express from "express";
import { AuthControllers } from "./auth.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { validateRequest } from "../../middlewares/validateRequest";
import { redisClient } from "../../config/redis";

import {
  changePasswordZodSchema,
  sendOtpZodSchema,
  verifyOtpZodSchema,
  staffLoginZodSchema,
  setPasswordZodSchema,
} from "./auth.validation";

const router = express.Router();

router.post(
  "/staff-login",
  // validateRequest(staffLoginZodSchema),
  AuthControllers.staffLogin,
);

router.get("/redis-test", async (_, res) => {
  await redisClient.set("test", "insurance");

  const value = await redisClient.get("test");

  res.json({
    success: true,
    value,
  });
});

router.post(
  "/send-otp",
  validateRequest(sendOtpZodSchema),
  AuthControllers.sendOtp,
);

router.post(
  "/verify-otp",
  validateRequest(verifyOtpZodSchema),
  AuthControllers.verifyOtp,
);

router.post("/logout", AuthControllers.logout);

router.post("/refresh-token", AuthControllers.getNewAccessToken);

router.post(
  "/change-password",
  checkAuth(...Object.values(Role)),
  validateRequest(changePasswordZodSchema),
  AuthControllers.changePassword,
);

router.post(
  "/admin/change-password",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  AuthControllers.adminChangePassword,
);

router.post(
  "/set-password",
  checkAuth(Role.CUSTOMER),
  validateRequest(setPasswordZodSchema),
  AuthControllers.setPassword,
);

export const authRoutes = router;
