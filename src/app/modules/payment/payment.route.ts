import express from "express";
import { PaymentController } from "./payment.controller";
import { Role } from "../user/user.interface";
import { checkAuth } from "../../middlewares/checkAuth";

const router = express.Router();

router.get("/pay/:transactionId", PaymentController.redirectPayment);

router.all(
    "/return",
    PaymentController.paymentReturn
);

router.all(
    "/cancel",
    PaymentController.paymentCancel
);

router.post(
    "/init-payment/:subscriptionId",
    PaymentController.initPayment
);


router.post("/validate-payment", PaymentController.validatePayment)
router.patch(
    "/:id/request-refund",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    PaymentController.requestSurjoPayRefund
);
router.get("/all-payments", checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.A_A_MANAGER), PaymentController.getAllPayments);
router.get("/all-trash-payments", checkAuth(Role.ADMIN, Role.SUPER_ADMIN, Role.A_A_MANAGER), PaymentController.getAllTrashPayments);
router.get("/:id", checkAuth(Role.ADMIN, Role.CUSTOMER, Role.SUPER_ADMIN, Role.A_A_MANAGER), PaymentController.getSinglePayment);
router.patch("/:id", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), PaymentController.updatePayment);
router.patch("/restore/:id", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), PaymentController.restorePayment);
router.delete("/soft-delete/:id", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), PaymentController.softDeletePayment);
router.delete("/:id", checkAuth(Role.ADMIN, Role.SUPER_ADMIN), PaymentController.deletePayment);

export const paymentRoutes = router;