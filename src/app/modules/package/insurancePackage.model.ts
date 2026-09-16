import { Schema, model } from "mongoose";
import { IInsurancePackage, IPlan, PlanType } from "./insurance-package.interface";

const planSchema = new Schema<IPlan>(
    {
        type: {
            type: String,
            enum: Object.values(PlanType),
            required: true,
        },
        durationInMonths: {
            type: Number,
            required: true,
            min: 1,
        },
        regularPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        discountPrice: {
            type: Number,
            min: 0,
        }
    },
    {
        _id: false,
    }
);

const packagePartnerDiscountSchema = new Schema(
    {
        partner: {
            type: Schema.Types.ObjectId,
            ref: "Partner",
            required: true,
        },

        discountPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { _id: false }
);

const insurancePackageSchema = new Schema<IInsurancePackage>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
        },

        featureImage: {
            type: String,
            trim: true,
        },

        coverageAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        plans: {
            type: [planSchema],
            required: true,
        },

        partnerDiscounts: {
            type: [packagePartnerDiscountSchema],
            default: [],
        },

        benefits: {
            type: [String],
            default: [],
        },

        exclusions: {
            type: [String],
            default: [],
        },


        // whether this package covers 1 person (Single) or 2 persons (Joint)
        isJoint: {
            type: Boolean,
            default: false,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },

    },
    {
        timestamps: true,
    }
);

// Auto Generate Slug on Create
insurancePackageSchema.pre("save", async function () {
    if (this.isModified("name")) {
        const baseSlug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        let slug = baseSlug;
        let counter = 1;

        const InsurancePackage = model<IInsurancePackage>(
            "InsurancePackage"
        );

        while (await InsurancePackage.exists({ slug })) {
            slug = `${baseSlug}-${counter++}`;
        }

        this.slug = slug;
    }
});

// Auto Generate Slug on Update
insurancePackageSchema.pre("findOneAndUpdate", async function () {
    const update = this.getUpdate() as Partial<IInsurancePackage>;

    if (update.name) {
        const baseSlug = update.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        let slug = baseSlug;
        let counter = 1;

        const InsurancePackage = model<IInsurancePackage>(
            "InsurancePackage"
        );

        while (await InsurancePackage.exists({ slug })) {
            slug = `${baseSlug}-${counter++}`;
        }

        update.slug = slug;
    }

    this.setUpdate(update);
});

export const InsurancePackage = model<IInsurancePackage>(
    "InsurancePackage",
    insurancePackageSchema
);