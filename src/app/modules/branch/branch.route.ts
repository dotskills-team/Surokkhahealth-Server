import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { BranchControllers } from "./branch.controller";
import { object } from "zod/v4";

const router = express.Router();

router.post(
  "/create-branch",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  BranchControllers.createPartnerBranch,
);

router.get(
  "/all-branches",
  checkAuth(...Object.values(Role)),
  BranchControllers.getAllPartnerBranches,
);

router.get(
  "/all-trash-branches",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  BranchControllers.getAllTrashPartnerBranches,
); 
router.get(
  "/:id",
  checkAuth(...Object.values(Role)),
  BranchControllers.getSinglePartnerBranch,
);

router.patch(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  BranchControllers.updatePartnerBranch,
);

router.patch(
  "/soft-delete/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  BranchControllers.softDeletePartnerBranch,
);

router.delete(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
  BranchControllers.deletePartnerBranch,
);

router.get(
  "/nearby/search",
  checkAuth(...Object.values(Role)),
  BranchControllers.getNearbyBranches,
);

router.patch(
    "/restore/:id",
    checkAuth(Role.SUPER_ADMIN, Role.MANAGER, Role.ADMIN),
    BranchControllers.restorePartnerBranch
);

export const branchRoutes = router;