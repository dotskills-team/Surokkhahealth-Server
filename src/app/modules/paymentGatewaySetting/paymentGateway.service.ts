import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { PaymentGateway } from "./paymentGateway.interface";
import { PaymentSetting } from "./paymentGateway.model";


const SETTING_KEY = "payment-setting";

const getActiveGateway = async (): Promise<PaymentGateway> => {
    const setting = await PaymentSetting.findOne({ key: SETTING_KEY }).lean();
    return setting?.activeGateway ?? PaymentGateway.SURJOPAY;
};

const getPaymentSetting = async () => {
    const setting = await PaymentSetting.findOne({ key: SETTING_KEY })
        .populate("updatedBy", "name email role")
        .lean();

    return {
        activeGateway: setting?.activeGateway ?? PaymentGateway.SURJOPAY,
        updatedBy: setting?.updatedBy ?? null,
        updatedAt: (setting as any)?.updatedAt ?? null,
    };
};

const updatePaymentSetting = async (
    activeGateway: PaymentGateway,
    updatedBy?: string
) => {
    if (!Object.values(PaymentGateway).includes(activeGateway)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Invalid gateway. Allowed: ${Object.values(PaymentGateway).join(", ")}`
        );
    }

    const setting = await PaymentSetting.findOneAndUpdate(
        { key: SETTING_KEY },
        { $set: { activeGateway, ...(updatedBy && { updatedBy }) } },
        {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
            setDefaultsOnInsert: true,
        }
    );

    return { data: setting };
};

export const PaymentSettingService = {
    getActiveGateway,
    getPaymentSetting,
    updatePaymentSetting,
};