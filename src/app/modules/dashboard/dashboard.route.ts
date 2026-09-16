import { Router } from "express";

import { DashboardControllers } from "./dashboard.controller";

import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = Router();

router.get(
  "/overview",
  checkAuth(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.MANAGER,
    Role.A_A_MANAGER,
    Role.AGENT_LEADER,
    Role.AGENT,
    Role.CUSTOMER,
  ),
  DashboardControllers.getDashboardOverview,
);

router.get(
  "/manager",
  checkAuth(Role.MANAGER),
  DashboardControllers.getManagerOverview,
);

export const DashboardRoutes = router;
