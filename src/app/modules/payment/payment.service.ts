

import { PaymentModel } from "./payment.model";
import { PaymentStatus } from "./payment.interface";
import { SSLCommerzService } from "../sslCommerz/sslCommerz.service";
import AppError from "../../errorHelpers/appError";
import httpStatus from "http-status-codes"
import mongoose from "mongoose";
import { User } from "../user/user.model";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { paymentSearchableFields } from "./payment.constants";
import { Subscription } from "../subscription/subscription.model";
import { SubscriptionStatus } from "../subscription/subscription.interface";
import { SurjoPayService } from "../surjoPay/surjoPay.service";

import { sendSMS } from "../../utils/sendSms";
import { MessageType } from "../message/message.interface";
import { envVars } from "../../config/env";
import { IsActive } from "../user/user.interface";

const initPayment = async (subscriptionId: any) => {

    const payment = await PaymentModel.findOne({
        subscription: subscriptionId,
    });
    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    const subscription = await Subscription.findById(subscriptionId);

    const customer = await User.findById(subscription?.customer);

    if (!customer) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Customer not found"
        );
    }

    const surjoPayPayload = {
        amount: payment.amount,
        orderId: payment.transactionId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAddress: customer?.address?.thana || "N/A",
        customerCity: customer?.address?.district || "N/A",
        customerCountry: "Bangladesh",
    };

    const paymentResponse = await SurjoPayService.paymentInit(
        surjoPayPayload
    );

    const paymentLink = `${envVars.SERVER_URL}/api/v1/payment/pay/${payment.transactionId}`;

    await sendSMS(
        customer.phone,
        `Thank you for choosing surokkhahealth.com! To activate your subscription, please complete your payment using the secure link below:\n\n${paymentLink}\n\nOnce your payment is successful, your subscription will be activated automatically.`,
        MessageType.SUBSCRIPTION
    );

    return {
        paymentUrl: paymentResponse.checkoutUrl,
    };
};

const getPaymentUrl = async (transactionId: string) => {
    const payment = await PaymentModel.findOne({ transactionId });

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    const subscription = await Subscription.findById(payment.subscription);

    if (!subscription) {
        throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    const customer = await User.findById(subscription.customer);

    if (!customer) {
        throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
    }

    const paymentResponse = await SurjoPayService.paymentInit({
        amount: payment.amount,
        orderId: payment.transactionId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAddress: customer?.address?.thana || "N/A",
        customerCity: customer?.address?.district || "N/A",
        customerCountry: "Bangladesh",
    });

    return paymentResponse.checkoutUrl;
};

const updatePayment = async (id: string, payload: any) => {
    const existingPayment = await PaymentModel.findById(id);

    if (!existingPayment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    // Generic status-update guard: REFUNDED can't be set through this
    // endpoint anymore. Refunds are handled by dedicated flows:
    //   - SurjoPay -> requestSurjoPayRefund() sets REFUND_PENDING,
    //     the reconciliation cron confirms REFUNDED later.
    if (payload.status === PaymentStatus.REFUNDED) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "REFUNDED status can't be set directly. Use the request-refund endpoint instead."
        );
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const updatedPayment = await PaymentModel.findByIdAndUpdate(
            id,
            payload,
            { returnDocument: "after", runValidators: true, session }
        ).populate({
            path: "subscription",
            populate: {
                path: "customer",
                select: "phone name _id",
            },
        });;
        if (!updatedPayment) {
            throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
        }

        const customer = (updatedPayment?.subscription as any)?.customer?._id;

        if (payload.status === PaymentStatus.PAID) {
            await Subscription.findByIdAndUpdate(
                updatedPayment.subscription,
                {
                    paymentStatus: PaymentStatus.COMPLETED,
                    status: SubscriptionStatus.ACTIVE,
                    isActive: true,
                },
                { session }
            );

            await User.findByIdAndUpdate(
                customer,
                { isActive: IsActive.ACTIVE },
                { session }
            );
        } else if (payload.status === PaymentStatus.FAILED) {
            await Subscription.findByIdAndUpdate(
                updatedPayment.subscription,
                {
                    paymentStatus: PaymentStatus.FAILED,
                    status: SubscriptionStatus.FAILED,
                    isActive: false,
                },
                { session }
            );
        } else if (payload.status === PaymentStatus.CANCELLED) {
            await Subscription.findByIdAndUpdate(
                updatedPayment.subscription,
                {
                    paymentStatus: PaymentStatus.CANCELLED,
                    status: SubscriptionStatus.CANCELLED,
                    isActive: false,
                },
                { session }
            );
        }

        await session.commitTransaction();
        return { data: updatedPayment };

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getPaymentDayBoundariesUTC = (dateStr: string) => {
    const d = new Date(dateStr);
    const start = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
    );
    const end = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
    );
    return { start, end };
};

const buildPaymentDateFilter = (
    startDateStr: string | undefined,
    endDateStr: string | undefined,
): Record<string, { $gte?: Date; $lte?: Date }> => {
    if (!startDateStr && !endDateStr) return {};

    if (startDateStr && endDateStr) {
        return {
            createdAt: {
                $gte: getPaymentDayBoundariesUTC(startDateStr).start,
                $lte: getPaymentDayBoundariesUTC(endDateStr).end,
            },
        };
    }

    if (startDateStr) {
        const { start, end } = getPaymentDayBoundariesUTC(startDateStr);
        return { createdAt: { $gte: start, $lte: end } };
    }

    const { start, end } = getPaymentDayBoundariesUTC(endDateStr!);
    return { createdAt: { $gte: start, $lte: end } };
};

const buildPaymentQueryObj = (query: Record<string, string>) => {
    const queryObj: any = {};

    const startDateStr = query["startDate"];
    const endDateStr = query["endDate"];

    Object.assign(queryObj, buildPaymentDateFilter(startDateStr, endDateStr));

    if (query.status) queryObj.status = query.status;

    delete query.startDate;
    delete query.endDate;
    delete query.dateType;

    return { queryObj, startDateStr, endDateStr };
};

const getPaymentStats = async (match: Record<string, any>) => {
    const agg = await PaymentModel.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
                unpaid: { $sum: { $cond: [{ $eq: ["$status", "UNPAID"] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
                refunded: { $sum: { $cond: [{ $eq: ["$status", "REFUNDED"] }, 1, 0] } },
                totalRevenue: {
                    $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] },
                },
            },
        },
    ]);

    return agg[0] || {
        total: 0, completed: 0, unpaid: 0,
        failed: 0, cancelled: 0, refunded: 0, totalRevenue: 0,
    };
};


const buildCustomerSubscriptionFilter = async (searchTerm: string | undefined) => {
    if (!searchTerm) return null;

    // 1. Find matching users by name or phone
    const matchingUsers = await User.find({
        $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { phone: { $regex: searchTerm, $options: "i" } },
        ],
    }).select("_id");

    if (matchingUsers.length === 0) return { subscription: { $in: [] } };
    // empty array -> intentionally guarantees no false-positive match later

    const userIds = matchingUsers.map((u) => u._id);

    // 2. Find subscriptions belonging to those users
    const matchingSubscriptions = await Subscription.find({
        customer: { $in: userIds },
    }).select("_id");

    const subscriptionIds = matchingSubscriptions.map((s) => s._id);

    return { subscription: { $in: subscriptionIds } };
};

const getAllPayments = async (query: Record<string, string>) => {
    const searchTerm = query.searchTerm;

    const { queryObj, startDateStr, endDateStr } =
        buildPaymentQueryObj(query);

    const customerFilter = await buildCustomerSubscriptionFilter(searchTerm);

    const finalFilter: any = { isDeleted: false, ...queryObj };

    if (customerFilter && searchTerm) {
        // combine transactionId/status search (handled by QueryBuilder.search)
        // with customer-name/phone based subscription match
        finalFilter.$or = [
            { transactionId: { $regex: searchTerm, $options: "i" } },
            customerFilter,
        ];

        // remove searchTerm so QueryBuilder doesn't re-apply its own narrower search
        delete query.searchTerm;
    }

    const baseQuery = PaymentModel.find(finalFilter);
    const queryBuilder = new QueryBuilder(baseQuery, query);

    const data = await queryBuilder
        .filter()
        .sort()
        .fields()
        .paginate()
        .build()
        .populate({
            path: "subscription",
            select: "planType durationInMonths price status customer",
            populate: {
                path: "customer",
                select: "name phone",
            },
        });

    const meta = await queryBuilder.getMeta();

    const statsMatch = { isDeleted: false, ...buildPaymentDateFilter(startDateStr, endDateStr) };
    const stats = await getPaymentStats(statsMatch);

    return { data, meta, stats };
};


// =============================================================
// GET ALL TRASH PAYMENTS
// =============================================================
const getAllTrashPayments = async (query: Record<string, string>) => {
    const { queryObj, startDateStr, endDateStr } =
        buildPaymentQueryObj(query);

    const baseQuery = PaymentModel.find({ isDeleted: true, ...queryObj });
    const queryBuilder = new QueryBuilder(baseQuery, query);

    const data = await queryBuilder
        .search(paymentSearchableFields)
        .filter()
        .sort()
        .fields()
        .paginate()
        .build()
        .populate("subscription", "planType durationInMonths price status");

    const meta = await queryBuilder.getMeta();

    const statsMatch = { isDeleted: false, ...buildPaymentDateFilter(startDateStr, endDateStr) };
    const stats = await getPaymentStats(statsMatch);

    return { data, meta, stats };
};

// =============================================================
// RESTORE PAYMENT
// =============================================================
const restorePayment = async (id: string) => {
    const payment = await PaymentModel.findById(id);

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    const result = await PaymentModel.findByIdAndUpdate(
        id,
        { isDeleted: false },
        { returnDocument: "after" },
    );

    return { data: result };
};

const getSinglePayment = async (id: string) => {
    const result = await PaymentModel.findById(id)
        .populate("subscription");

    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    return { data: result };
};

const softDeletePayment = async (id: string) => {
    const payment = await PaymentModel.findById(id);

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }
    await PaymentModel.findByIdAndUpdate(
        id,
        {
            isDeleted: true,
        }
    );

    return null;
};

const deletePayment = async (id: string) => {
    const result = await PaymentModel.findByIdAndDelete(id);
    return { data: result };
};

const verifyAndFinalizePayment = async (spOrderId: string) => {
    if (!spOrderId) {
        throw new AppError(httpStatus.BAD_REQUEST, "order_id not found");
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // ==========================================
        // IDEMPOTENCY CHECK — process shuru howar age
        // ==========================================
        const existingPayment = await PaymentModel.findOne({
            spOrderId,
        }).session(session);

        if (existingPayment && existingPayment.status === PaymentStatus.PAID) {
            await session.commitTransaction();
            return {
                success: true,
                status: existingPayment.status,
                transactionId: existingPayment.transactionId,
                amount: existingPayment.amount,
            };
        }

        const verifiedData = await SurjoPayService.verifyPayment(spOrderId);

        const transactionId = verifiedData?.customer_order_id;

        if (!transactionId) {
            throw new AppError(
                httpStatus.NOT_FOUND,
                "Transaction not found in ShurjoPay verification response"
            );
        }

        // ==========================================
        // AMOUNT TAMPERING CHECK
        // ==========================================
        const paymentDoc = await PaymentModel.findOne({
            transactionId,
        }).session(session);

        if (!paymentDoc) {
            throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
        }

        // already PAID (transactionId diye dobara check — spOrderId na thakleo)
        if (paymentDoc.status === PaymentStatus.PAID) {
            await session.commitTransaction();
            return {
                success: true,
                status: paymentDoc.status,
                transactionId,
                amount: paymentDoc.amount,
            };
        }

        const verifiedAmount = Number(verifiedData?.amount);

        if (
            !verifiedAmount ||
            Math.abs(verifiedAmount - paymentDoc.amount) > 0.01
        ) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Amount mismatch - possible tampering. Expected ${paymentDoc.amount}, got ${verifiedAmount}`
            );
        }

        const isSuccess =
            verifiedData?.sp_code === "1000" ||
            verifiedData?.bank_status === "Success";

        const isCancelled = verifiedData?.bank_status === "Cancel";

        let newPaymentStatus: PaymentStatus;

        if (isSuccess) {
            newPaymentStatus = PaymentStatus.PAID;
        } else if (isCancelled) {
            newPaymentStatus = PaymentStatus.CANCELLED;
        } else {
            newPaymentStatus = PaymentStatus.FAILED;
        }

        const updatedPayment = await PaymentModel.findOneAndUpdate(
            { transactionId },
            {
                status: newPaymentStatus,
                spOrderId,
                paymentGatewayData: verifiedData,
            },
            { returnDocument: "after", runValidators: true, session }
        );

        if (!updatedPayment) {
            throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
        }

        if (newPaymentStatus === PaymentStatus.PAID) {
            const subscription = await Subscription.findById(
                updatedPayment.subscription
            ).session(session);

            if (!subscription) {
                throw new AppError(
                    httpStatus.NOT_FOUND,
                    "Subscription not found"
                );
            }

            const startDate = new Date();

            const endDate =
                subscription.isLifetime || !subscription.durationInMonths
                    ? null
                    : new Date(
                        startDate.getTime() +
                        subscription.durationInMonths * 30 * 24 * 60 * 60 * 1000
                    );

            await Subscription.findByIdAndUpdate(
                updatedPayment.subscription,
                {
                    status: SubscriptionStatus.ACTIVE,
                    paymentStatus: PaymentStatus.COMPLETED,
                    isActive: true,
                    startDate,
                    ...(endDate !== null && { endDate }),
                },
                { session }
            );
        } else if (newPaymentStatus === PaymentStatus.CANCELLED) {
            await Subscription.findByIdAndUpdate(
                updatedPayment.subscription,
                { status: SubscriptionStatus.CANCELLED },
                { session }
            );
        } else {
            await Subscription.findByIdAndUpdate(
                updatedPayment.subscription,
                { status: SubscriptionStatus.FAILED },
                { session }
            );
        }

        await session.commitTransaction();

        return {
            success: newPaymentStatus === PaymentStatus.PAID,
            status: newPaymentStatus,
            transactionId,
            amount: updatedPayment.amount,
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const requestSurjoPayRefund = async (id: string, reason?: string) => {
    const payment = await PaymentModel.findById(id);

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
    }

    if (!payment.spOrderId) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "This payment was not processed via SurjoPay"
        );
    }

    if (payment.status !== PaymentStatus.PAID) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Only PAID payments are eligible for refund. Current status: ${payment.status}`
        );
    }

    const updated = await PaymentModel.findByIdAndUpdate(
        id,
        {
            status: PaymentStatus.REFUND_PENDING,
            refundReason: reason,
            refundRequestedAt: new Date(),
        },
        { returnDocument: "after", runValidators: true }
    );

    return { data: updated };
};

export const PaymentService = {
    initPayment,
    updatePayment,
    requestSurjoPayRefund,
    getAllPayments,
    getSinglePayment,
    softDeletePayment,
    deletePayment,
    getAllTrashPayments,
    restorePayment,
    verifyAndFinalizePayment,
    getPaymentUrl,
};
