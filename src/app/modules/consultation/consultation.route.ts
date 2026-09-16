import express from "express";
import { ConsultationControllers } from "./consultation.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { validateRequest } from "../../middlewares/validateRequest";
import { updateConsultationStatusValidationSchema } from "./consultation.validation";

const router = express.Router();

router.post(
  "/initiate",
  checkAuth(Role.CUSTOMER),
  ConsultationControllers.initiateConsultation,
);

router.get(
  "/my-consultations",
  checkAuth(Role.CUSTOMER),
  ConsultationControllers.getMyConsultations,
);

router.get(
  "/active",
  checkAuth(Role.CUSTOMER),
  ConsultationControllers.getActiveConsultation,
);

router.get(
  "/:id/prescription",
  checkAuth(Role.CUSTOMER),
  ConsultationControllers.getPrescription,
);

router.get(
  "/my-consultations/count",
  checkAuth(Role.CUSTOMER),
  ConsultationControllers.getMyConsultationCount,
);

router.get(
  "/:id",
  checkAuth(...Object.values(Role)),
  ConsultationControllers.getSingleConsultation,
);

router.patch(
  "/:id/status",
  checkAuth(Role.CUSTOMER),
  validateRequest(updateConsultationStatusValidationSchema),
  ConsultationControllers.updateConsultationStatus,
);

export const consultationRoutes = router;