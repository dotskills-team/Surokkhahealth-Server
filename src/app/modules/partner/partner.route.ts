import express from "express";
import { PartnerController } from "./partner.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { validateRequest } from "../../middlewares/validateRequest";
import { createPartnerZodSchema, updatePartnerZodSchema } from "./partner.validation";
import { multerUpload } from "../../config/multer.config";

const router = express.Router();

router.post(
  "/create-partner",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER),
  multerUpload.single("logo"),          
  validateRequest(createPartnerZodSchema), 
  PartnerController.createPartner    
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER),
  multerUpload.single("logo"),
  validateRequest(updatePartnerZodSchema),
  PartnerController.updatePartner
);

router.get(
    "/all-partners",
    checkAuth(...Object.values(Role)),
    PartnerController.getAllPartners
);

router.get(
    "/all-trash-partners",
    checkAuth(...Object.values(Role)),
    PartnerController.getAllTrashPartners
);

router.get(
    "/:id",
    checkAuth(...Object.values(Role)),
    PartnerController.getSinglePartner
);

router.patch(
    "/soft-delete/:id",
    checkAuth(Role.SUPER_ADMIN, Role.MANAGER, Role.ADMIN),
    PartnerController.softDeletePartner
);

router.patch(
    "/restore/:id",
    checkAuth(Role.SUPER_ADMIN, Role.MANAGER, Role.ADMIN),
    PartnerController.restorePartner
);

router.delete(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.MANAGER, Role.ADMIN),
    PartnerController.deletePartner
);
export const PartnerRoutes = router;