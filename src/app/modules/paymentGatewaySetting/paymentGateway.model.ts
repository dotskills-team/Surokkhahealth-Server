import { model, Schema } from "mongoose";
import { IPaymentSetting, PaymentGateway } from "./paymentGateway.interface";

const paymentSettingSchema = new Schema<IPaymentSetting>(
    {
        key: {
            type: String,
            default: "payment-setting",
            unique: true,
            immutable: true,
        },
        activeGateway: {
            type: String,
            enum: Object.values(PaymentGateway),
            default: PaymentGateway.SURJOPAY,
            required: true,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

export const PaymentSetting = model<IPaymentSetting>(
    "PaymentSetting",
    paymentSettingSchema
);