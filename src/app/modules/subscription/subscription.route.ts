import express from "express";
import { SubscriptionControllers } from "./subscription.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { validateRequest } from "../../middlewares/validateRequest";
import { createSubscriptionValidationSchema } from "./subscription.validation";

const router = express.Router();

router.post(
  "/create-subscription",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT, Role.AGENT_LEADER, Role.CUSTOMER),
  validateRequest(createSubscriptionValidationSchema),
  SubscriptionControllers.createSubscription,
);

router.get(
  "/all-subscriptions",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.A_A_MANAGER),
  SubscriptionControllers.getAllSubscriptions,
);

router.get(
  "/customer/:customerId",
  checkAuth(...Object.values(Role)),
  SubscriptionControllers.getCustomerSubscriptions,
);

router.get(
  "/agents-all-subscriptions/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.AGENT_LEADER, Role.A_A_MANAGER),
  SubscriptionControllers.getAgentsAllSubscriptions,
);
router.get(
  "/leader-subscriptions/me",
  checkAuth(Role.AGENT_LEADER),
  SubscriptionControllers.getAgentLeaderSubscriptions,
);

// Overview Analytics

router.get(
  "/overview/admin",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  SubscriptionControllers.getAdminOverview,
);

router.get(
  "/overview/agent-leader",
  checkAuth(Role.AGENT_LEADER),
  SubscriptionControllers.getAgentLeaderOverview,
);

router.get(
  "/overview/agent",
  checkAuth(Role.AGENT),
  SubscriptionControllers.getAgentOverview,
);

router.get(
  "/leader-subscriptions/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  SubscriptionControllers.getAgentLeaderSubscriptionsByAdmin,
);

router.get(
  "/my-subscriptions",
  checkAuth(...Object.values(Role)),
  SubscriptionControllers.getMySubscriptions,
);

router.get(
  "/all-trash-subscriptions",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  SubscriptionControllers.getAllTrashSubscriptions,
);

router.get(
  "/:id",
  checkAuth(...Object.values(Role)),
  SubscriptionControllers.getSingleSubscription,
);

router.get(
  "/my-trash-subscriptions",
  checkAuth(Role.AGENT),
  SubscriptionControllers.getMyTrashSubscriptions,
);

router.get(
  "/leader-trash-subscriptions/me",
  checkAuth(Role.AGENT_LEADER),
  SubscriptionControllers.getAgentLeaderTrashSubscriptions,
);

router.patch(
  "/soft-delete/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT_LEADER),
  SubscriptionControllers.softDeleteSubscription,
);

router.patch(
  "/restore/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.AGENT_LEADER),
  SubscriptionControllers.restoreSubscription,
);

router.delete(
  "/permanent-delete/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.AGENT_LEADER),
  SubscriptionControllers.permanentDeleteSubscription,
);

router.patch(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT_LEADER, Role.AGENT),
  SubscriptionControllers.updateSubscription,
);

export const subscriptionRoutes = router;
