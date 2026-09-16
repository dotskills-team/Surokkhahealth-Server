import { model, Schema } from "mongoose";
import { IContact } from "./contact.interface";

const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      index: true,
    },

    email: {
      type: String,
      trim: true,
    },

    subject: {
      type: String,
      trim: true,
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    isReplied: {
      type: Boolean,
      default: false,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    relatedPackage: {
      type: Schema.Types.ObjectId,
      ref: "InsurancePackage",
    },

    relatedPartner: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Contact = model<IContact>("Contact", contactSchema);