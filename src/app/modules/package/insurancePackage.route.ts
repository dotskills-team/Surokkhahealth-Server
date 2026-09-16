import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { validateRequest } from "../../middlewares/validateRequest";
import { createInsurancePackageValidationSchema, updateInsurancePackageValidationSchema } from "./insurancePackage.valiation";
import { PackageControllers } from "./insurancePackage.controller";
import { multerUpload } from "../../config/multer.config";


const router = express.Router();

router.post(
  "/create-package",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  multerUpload.single("featureImage"),
  validateRequest(createInsurancePackageValidationSchema),
  PackageControllers.createPackage,
);

router.get(
  "/all-packages",
  // checkAuth(...Object.values(Role)),
  PackageControllers.getAllPackages,
);

router.get(
  "/all-trash-packages",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  PackageControllers.getAllTrashPackages,
);

router.get(
  "/:id",
  checkAuth(...Object.values(Role)),
  PackageControllers.getSinglePackage,
);

router.patch(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  multerUpload.single("featureImage"),
  validateRequest(updateInsurancePackageValidationSchema),
  PackageControllers.updatePackage,
);

router.patch(
  "/soft-delete/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  PackageControllers.softDeletePackage,
);

router.delete(
  "/:id",
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  PackageControllers.deletePackage,
);

export const packageRoutes = router;