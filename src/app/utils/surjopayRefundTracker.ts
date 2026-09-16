import cron from "node-cron";
import mongoose from "mongoose";
import { PaymentModel } from "../modules/payment/payment.model";
import { PaymentStatus } from "../modules/payment/payment.interface";
import { SurjoPayService } from "../modules/surjoPay/surjoPay.service";
import { Subscription } from "../modules/subscription/subscription.model";
import { SubscriptionStatus } from "../modules/subscription/subscription.interface";

const REFUND_CONFIRMED_STATUSES = ["Refunded"];

const reconcilePendingSurjoPayRefunds = async () => {
    const pendingPayments = await PaymentModel.find({
        status: PaymentStatus.REFUND_PENDING,
        spOrderId: { $exists: true, $ne: null },
    });

    if (pendingPayments.length === 0) return;

    for (const payment of pendingPayments) {
        try {
            const verifiedData = await SurjoPayService.verifyPayment(
                payment.spOrderId as string
            );

            const isRefunded = REFUND_CONFIRMED_STATUSES.includes(
                verifiedData?.bank_status
            );

            if (!isRefunded) continue;

            const session = await mongoose.startSession();
            try {
                session.startTransaction();

                await PaymentModel.findByIdAndUpdate(
                    payment._id,
                    {
                        status: PaymentStatus.REFUNDED,
                        refundData: verifiedData,
                        refundedAt: new Date(),
                    },
                    { session, runValidators: true }
                );

                await Subscription.findByIdAndUpdate(
                    payment.subscription,
                    { status: SubscriptionStatus.REFUNDED },
                    { session }
                );

                await session.commitTransaction();
                console.log(
                    `[SurjoPay Refund] Payment ${payment.transactionId} -> REFUNDED`
                );
            } catch (err) {
                await session.abortTransaction();
                console.error(
                    `[SurjoPay Refund] Failed to finalize ${payment.transactionId}`,
                    err
                );
            } finally {
                session.endSession();
            }
        } catch (err: any) {
            console.error(
                `[SurjoPay Refund] verify failed for spOrderId=${payment.spOrderId}`,
                err.message
            );
        }
    }
};

export const startSurjoPayRefundCron = () => {
    cron.schedule("*/30 * * * *", () => {
        reconcilePendingSurjoPayRefunds().catch((err) =>
            console.error("[SurjoPay Refund Cron] Unexpected error", err)
        );
    });
};