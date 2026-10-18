import { Types } from "mongoose";

export enum PaymentGateway {
    SURJOPAY = "SURJOPAY",
    SSLCOMMERZ = "SSLCOMMERZ",
}

export interface IPaymentSetting {
    key: string; // singleton key, always "payment-setting"
    activeGateway: PaymentGateway;
    updatedBy?: Types.ObjectId;
}