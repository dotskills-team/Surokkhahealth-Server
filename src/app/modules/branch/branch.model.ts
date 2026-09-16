import { Schema, model } from "mongoose";

const partnerBranchSchema = new Schema(
  {
    partner: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },

    branchName: {
      type: String,
      required: true,
    },

    phone: String,

    email: String,

    address: {
      type: String,
      required: true,
    },

    city: String,

    area: String,

    postalCode: String,

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        required: true,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

partnerBranchSchema.index({
  location: "2dsphere",
});

export const PartnerBranch = model(
  "PartnerBranch",
  partnerBranchSchema,
);