import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { SiteSettingController } from "./siteSetting.controller";

const router = express.Router();

router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  SiteSettingController.getSiteSetting,
);

router.patch(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  SiteSettingController.updateSiteSetting,
);

export const siteSettingRoutes = router;
