import { z } from "zod";

export const PlanTypeEnum = z.enum([
    "MONTHLY",
    "QUARTERLY",
    "HALF_YEARLY",
    "YEARLY",
    "LIFETIME"
]);

export const planValidationSchema = z.object({
    type: PlanTypeEnum,
    durationInMonths: z.number().min(1, "Duration must be at least 1 month"),
    regularPrice: z.number().min(0, "Price must be 0 or greater"),
    discountPrice: z.number().min(0, "Price must be 0 or greater").optional(),
});

export const packagePartnerDiscountSchema = z.object({
    partner: z
        .string()
        .min(1, "Partner is required"),

    discountPercent: z
        .number()
        .min(0, "Discount must be 0 or greater")
        .max(100, "Discount cannot exceed 100"),

    isActive: z.boolean().optional().default(true),
});

export const createInsurancePackageValidationSchema = z.object({
    name: z.string().min(2, "Name is required"),

    slug: z
        .string()
        .optional(),
    
    featureImage: z.string().optional(),    
    description: z.string().optional(),

    coverageAmount: z
        .number()
        .min(1, "Coverage amount must be greater than 0"),

    plans: z
        .array(planValidationSchema)
        .min(1, "At least one plan is required"),

    benefits: z.array(z.string()).optional().default([]),

    exclusions: z.array(z.string()).optional().default([]),
    partnerDiscounts: z
        .array(packagePartnerDiscountSchema)
        .optional()
        .default([]),
   // whether this package is a Joint (2-person) package
    isJoint: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
});


export const updateInsurancePackageValidationSchema = createInsurancePackageValidationSchema.partial();