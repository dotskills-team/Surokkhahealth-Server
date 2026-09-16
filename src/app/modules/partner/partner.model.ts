import { Schema, model } from "mongoose";
import { IPartner, PartnerCategory } from "./partner.interface";

const partnerSchema = new Schema<IPartner>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    logo: String,

    description: String,
    category: {
      type: String,
      enum: Object.values(PartnerCategory),
    },
    phone: String,

    email: String,

    website: String,

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

export const Partner = model<IPartner>(
  "Partner",
  partnerSchema,
);