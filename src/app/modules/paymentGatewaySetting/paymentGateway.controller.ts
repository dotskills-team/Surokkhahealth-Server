import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentSettingService } from "./paymentGateway.service";

const getPaymentSetting = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentSettingService.getPaymentSetting();

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment setting retrieved successfully",
        data: result,
    });
});

const updatePaymentSetting = catchAsync(async (req: Request, res: Response) => {
    const decodedToken = req.user as JwtPayload;

    const result = await PaymentSettingService.updatePaymentSetting(
        req.body.activeGateway,
        decodedToken.userId
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment gateway updated successfully",
        data: result.data,
    });
});

export const PaymentSettingController = {
    getPaymentSetting,
    updatePaymentSetting,
};