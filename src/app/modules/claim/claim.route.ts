import { Router } from "express";

import { ClaimController } from "./claim.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { validateRequest } from "../../middlewares/validateRequest";

import {
    createClaimValidationSchema,
    updateClaimValidationSchema,
    reviewClaimValidationSchema,
} from "./claim.validation";

import { Role } from "../user/user.interface";
import { multerUpload } from "../../config/multer.config";

const router = Router();

router.post(
    "/create",
    checkAuth(
        Role.CUSTOMER,
        Role.AGENT,
        Role.AGENT_LEADER,
    ),
    multerUpload.array("attachments", 10),
    ClaimController.createClaim,
);

// Get All Claims
router.get(
    "/all-claims",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.AGENT_LEADER,
        Role.CLAIMS_MANAGER,
        Role.AGENT,
        Role.CUSTOMER,
    ),
    ClaimController.getAllClaims,
);
// Get All Trash Claims
router.get(
    "/all-trash-claims",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.AGENT_LEADER,
        Role.AGENT,
        Role.CUSTOMER,
    ),
    ClaimController.getAllTrashClaims,
);

// Get Single Claim
router.get(
    "/:id",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.CLAIMS_MANAGER,
        Role.AGENT_LEADER,
        Role.AGENT,
        Role.CUSTOMER,
    ),
    ClaimController.getSingleClaim,
);

router.patch(
  "/:id",
  checkAuth(Role.CUSTOMER),
  multerUpload.array("attachments", 10),
 
  ClaimController.updateClaim,
);

// Admin Review Claim
router.patch(
    "/review/:id",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.CLAIMS_MANAGER,
    ),
    validateRequest(
        reviewClaimValidationSchema,
    ),
    ClaimController.reviewClaim,
);

// Soft Delete Claim
router.patch(
    "/soft-delete/:id",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
    ),
    ClaimController.softDeleteClaim,
);
// Restore Claim
router.patch(
  "/restore/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  ClaimController.restoreClaim,
);

// Delete Claim
router.delete(
    "/:id",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
    ),
    ClaimController.deleteClaim,
);

export const ClaimRoutes = router;