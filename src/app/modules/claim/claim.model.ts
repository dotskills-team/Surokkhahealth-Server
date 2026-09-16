import { model, Schema } from "mongoose";
import {
  ClaimStatus,
  ClaimTitle,
  IClaim,
  PaymentMethod,
} from "./claim.interface";

const claimSchema = new Schema<IClaim>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subscription: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    attachments: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: Object.values(ClaimStatus),
      default: ClaimStatus.PENDING,
      index: true,
    },
    claimTitle: {
    type: String,
    enum: Object.values(ClaimTitle),
    required: true,
    index: true,
},
paymentMethod: {
    type: String,
    enum: Object.values(PaymentMethod),
    required: true,
},
paymentInfo: {
    mobileNumber: String,

    bankName: String,
    accountName: String,
    accountNumber: String,
    routingNumber: String,
    branchName: String,
},
    adminNote: {
      type: String,
      default: "",
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: {
      type: Date,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Claim = model<IClaim>(
  "Claim",
  claimSchema,
);