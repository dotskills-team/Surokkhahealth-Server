import cron from "node-cron";
import { PaymentService } from "../modules/payment/payment.service";

export const startSSLRefundCron = () => {
    cron.schedule("*/30 * * * *", () => {
        PaymentService.reconcileSSLRefunds().catch((err) =>
            console.error("[SSL Refund Cron] Unexpected error", err)
        );
    });
};