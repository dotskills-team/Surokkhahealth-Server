import express from "express";
import { UserControllers } from "./user.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { createUserZodSchema, updateUserZodSchema } from "./user.validation";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "./user.interface";
import { multerUpload } from "../../config/multer.config";

const router = express.Router();

// ─── CREATE ────────────────────────────────────────────────────────────────
router.post(
  "/create-user",
  checkAuth(Role.SUPER_ADMIN, Role.AGENT, Role.AGENT_LEADER, Role.ADMIN, Role.MANAGER),
  multerUpload.single("picture"),
  validateRequest(createUserZodSchema),
  UserControllers.createUser,
);

// ─── PROFILE ───
router.get("/me", checkAuth(...Object.values(Role)), UserControllers.getMe);

router.patch(
  "/update-profile",
  checkAuth(...Object.values(Role)),
  multerUpload.single("picture"),
  // validateRequest(updateUserZodSchema),
  UserControllers.updateProfile,
);

// ─── ALL STAFF (non-customer) ───
router.get(
  "/all-users",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllUsers,
);

router.get(
  "/all-trash-users",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllTrashUsers,
);

// ─── SUPER ADMIN / ADMIN — role-specific lists ─────────────────────────────
router.get(
  "/all-agent-leaders",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.A_A_MANAGER, Role.CLAIMS_MANAGER),
  UserControllers.getAllAgentLeaders,
);

router.get(
  "/all-agents",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.A_A_MANAGER,Role.CLAIMS_MANAGER),
  UserControllers.getAllAgents,
);

router.get(
  "/claims-managers",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllClaimsManagers,
);

router.get(
  "/trash/claims-managers",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllTrashClaimsManagers,
);

router.get(
  "/all-trash-agents",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  UserControllers.getAllTrashAgents,
);

router.get(
  "/all-admins",
  checkAuth(Role.SUPER_ADMIN),
  UserControllers.getAllAdmins,
);

router.get(
  "/all-trash-admins",
  checkAuth(Role.SUPER_ADMIN),
  UserControllers.getAllTrashAdmins,
);

router.get(
  "/all-managers",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllManagers,
);

router.get(
  "/all-trash-managers",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllTrashManagers,
);

router.get(
  "/all-a-a-managers",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllAAManagers,
);

router.get(
  "/all-trash-a-a-managers",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserControllers.getAllTrashAAManagers,
);

router.get(
  "/all-customers",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.CLAIMS_MANAGER, Role.AGENT_LEADER, Role.AGENT, Role.A_A_MANAGER),
  UserControllers.getAllCustomers,
);

// ─── AGENT LEADER — own resources ─────────────────────────────────────────
router.get(
  "/my-agents", // own agents
  checkAuth(Role.AGENT_LEADER),
  UserControllers.getMyAgents,
);

router.get(
  "/my-trash-agents",
  checkAuth(Role.AGENT_LEADER),
  UserControllers.getMyTrashAgents,
);

router.get(
  "/my-team-customers",
  checkAuth(Role.AGENT_LEADER),
  UserControllers.getMyCustomersByLeader,
);

router.get(
  "/my-trash-customers",
  checkAuth(Role.AGENT_LEADER),
  UserControllers.getMyTrashCustomers,
);

router.get(
  "/my-leader-customers", // customers created by own agents
  checkAuth(Role.AGENT_LEADER),
  UserControllers.getMyAgentLeaderCustomers,
);

router.get(
  "/leader-agent-customers/:agentId", // customers of a specific agent under this leader
  checkAuth(Role.AGENT_LEADER),
  UserControllers.getAgentCustomersByLeader,
);

// ─── AGENT — own resources ───
router.get(
  "/my-customers", // own customers
  checkAuth(Role.AGENT),
  UserControllers.getMyCustomers,
);

router.get(
  "/my-agent-customers", // same as my-customers but via getCustomersByAgent service
  checkAuth(Role.AGENT),
  UserControllers.getMyAgentCustomers,
);

// ─── ADMIN / SUPER ADMIN — agent-leader scoped ────
router.get(
  "/agent-leader-customers/:agentLeaderId", // all customers under a specific leader
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.CLAIMS_MANAGER),
  UserControllers.getAgentLeaderCustomersByAdmin,
);

router.get(
  "/agent-customers/:agentId", // all customers of a specific agent
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.CLAIMS_MANAGER),
  UserControllers.getAgentCustomersByAdmin,
);

// ─── SINGLE / UPDATE / DELETE ──────────────────────────────────────────────
router.get(
  "/:id",
  checkAuth(...Object.values(Role)),
  UserControllers.getSingleUser,
);

router.patch(
  "/:id",
  checkAuth(...Object.values(Role)),
  multerUpload.single("picture"),
  validateRequest(updateUserZodSchema),
  UserControllers.updateUser,
);

// Restore user from trash
router.patch(
  "/restore/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.AGENT_LEADER, Role.MANAGER),
  UserControllers.restoreUser,
);

// Permanently delete user
router.delete(
  "/permanent-delete/:id",
  checkAuth(Role.SUPER_ADMIN, Role.AGENT_LEADER, Role.ADMIN, Role.MANAGER),
  UserControllers.permanentDeleteUser,
);

router.delete(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.AGENT_LEADER, Role.ADMIN),
  UserControllers.deleteUser,
);

export const userRoutes = router;
