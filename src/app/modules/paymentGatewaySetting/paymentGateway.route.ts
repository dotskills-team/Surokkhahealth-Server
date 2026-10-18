import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { PaymentSettingController } from "./paymentGateway.controller";

const router = express.Router();

router.get(
    "/",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    PaymentSettingController.getPaymentSetting
);

router.patch(
    "/",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    PaymentSettingController.updatePaymentSetting
);

export const paymentSettingRoutes = router;