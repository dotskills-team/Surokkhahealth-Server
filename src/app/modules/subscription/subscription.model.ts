
import { Schema, model } from "mongoose";
import {
  ISubscription,
  SubscriptionStatus,
  PaymentStatus,
  SubscribeFor,
  NomineeSource,
} from "./subscription.interface";

const beneficiarySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    relationship: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

// 2nd covered person — only relevant when package.isJoint === true
// (validated on frontend for now, kept optional here)
const joinMemberSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    relationship: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const nomineeSchema = new Schema(
  {
    source: {
      type: String,
      enum: Object.values(NomineeSource),
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    relationship: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const subscriptionSchema = new Schema<ISubscription>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    package: {
      type: Schema.Types.ObjectId,
      ref: "InsurancePackage",
      required: true,
    },

    planType: {
      type: String,
      required: true,
    },

    durationInMonths: {
      type: Number,
    },

    price: {
      type: Number,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
    },

    transactionId: {
      type: String,
    },

    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    // Who the subscription actually covers
    subscribeFor: {
      type: String,
      enum: Object.values(SubscribeFor),
      default: SubscribeFor.SELF,
      required: true,
    },

    beneficiary: {
      type: beneficiarySchema,
      required: function (this: ISubscription) {
        return this.subscribeFor === SubscribeFor.OTHER;
      },
    },

    // Optional for now — required only when the selected package is
    // Joint. Enforced on the frontend for now.
    joinMember: {
      type: joinMemberSchema,
    },

    // Optional — nominee info, may mirror joinMember or be a separate person
    nominee: {
      type: nomineeSchema,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    autoRenew: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Subscription = model<ISubscription>(
  "Subscription",
  subscriptionSchema,
);