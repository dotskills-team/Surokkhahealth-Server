
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { PaymentService } from "./payment.service";
import { envVars } from "../../config/env";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status-codes"
import { SSLCommerzService } from "../sslCommerz/sslCommerz.service";
import { sendSMS } from "../../utils/sendSms";
import { MessageType } from "../message/message.interface";
import { PaymentModel } from "./payment.model";
import { User } from "../user/user.model";
import { IsActive } from "../user/user.interface";

const initPayment = catchAsync(
    async (req: Request, res: Response) => {
        const result =
            await PaymentService.initPayment(
                req.params.subscriptionId as string
            );

        sendResponse(res, {
            success: true,
            statusCode: httpStatus.OK,
            message: "Payment initialized successfully",
            data: result,
        });
    }
);

const redirectPayment = catchAsync(async (req: Request, res: Response) => {
    const { transactionId } = req.params;

    const url = await PaymentService.getPaymentUrl(transactionId as string);

    return res.redirect(url);
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.getAllPayments(
        req.query as Record<string, string>
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "All payments retrieved successfully",
        data: result.data,
        meta: result.meta,
        stats: result.stats
    });
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.getSinglePayment(req.params.id as string);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment retrieved successfully",
        data: result.data,
    });
});

const updatePayment = catchAsync(async (req: Request, res: Response) => {
    console.log(req.params.id, req.body);
    const result = await PaymentService.updatePayment(
        req.params.id as string,
        req.body
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment updated successfully",
        data: result.data,
    });
});

const softDeletePayment = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.softDeletePayment(req.params.id as string);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment deleted successfully",
        data: null
    });
});

const deletePayment = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.deletePayment(req.params.id as string);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment deleted successfully",
        data: result.data,
    });
});

const getAllTrashPayments = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.getAllTrashPayments(
        req.query as Record<string, string>
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Trashed payments retrieved successfully",
        data: result.data,
        meta: result.meta,
        stats: result.stats,
    });
});

const restorePayment = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.restorePayment(req.params.id as string);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment restored successfully",
        data: result.data,
    });
});

const validatePayment = catchAsync(
    async (req: Request, res: Response) => {
        console.log("sslcommerz ipn url body", req.body);
        await SSLCommerzService.validatePayment(req.body)
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Payment Validated Successfully",
            data: null,
        });
    }
);

const paymentReturn = catchAsync(
    async (req: Request, res: Response) => {
        const spOrderId = (req.query.order_id ||
            req.body.order_id) as string;

        const result = await PaymentService.verifyAndFinalizePayment(
            spOrderId
        );

        if (result.success) {

            const transactionId = result.transactionId;

            const payment = await PaymentModel.findOne({ transactionId }).populate({
                path: "subscription",
                populate: {
                    path: "customer",
                    select: "phone name",
                },
            });

            const customerPhone = (payment?.subscription as any)?.customer?.phone;
            const customerId = (payment?.subscription as any)?.customer?._id;

            await User.findByIdAndUpdate(
                customerId,
                { isActive: IsActive.ACTIVE }
            );

            await sendSMS(
                customerPhone,
                `Payment successful! Your Surokkha.com subscription is now active. Login: https://surokkhahealth.com/login Thank you for choosing Surokkha!`,
                MessageType.SUBSCRIPTION
            );

            return res.redirect(
                `${envVars.SSL.SSL_SUCCESS_FRONTEND_URL}?transactionId=${result.transactionId}&amount=${result.amount}&status=${result.status}`
            );
        }

        return res.redirect(
            `${envVars.SSL.SSL_FAIL_FRONTEND_URL}?transactionId=${result.transactionId}&amount=${result.amount}&status=${result.status}`
        );
    }
);

const paymentCancel = catchAsync(
    async (req: Request, res: Response) => {
        const spOrderId = (req.query.order_id ||
            req.body.order_id) as string;

        const result = await PaymentService.verifyAndFinalizePayment(
            spOrderId
        );

        return res.redirect(
            `${envVars.SSL.SSL_CANCEL_FRONTEND_URL}?transactionId=${result.transactionId}&amount=${result.amount}&status=${result.status}`
        );
    }
);

const requestSurjoPayRefund = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.requestSurjoPayRefund(
        req.params.id as string,
        req.body.reason
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Refund requested. Approve it on the SurjoPay merchant portal — status updates automatically once confirmed.",
        data: result.data,
    });
});

export const PaymentController = {
    initPayment,
    validatePayment,
    getAllPayments,
    getSinglePayment,
    updatePayment,
    softDeletePayment,
    deletePayment,
    getAllTrashPayments,
    restorePayment,
    paymentCancel,
    paymentReturn,
    requestSurjoPayRefund,
    redirectPayment
};