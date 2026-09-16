
// import { z } from "zod";
// import { createUserZodSchema } from "../user/user.validation";

// const beneficiaryZodSchema = z.object({
//   name: z
//     .string()
//     .min(1, "Beneficiary name is required"),

//   phone: z
//     .string()
//     .length(11, "Beneficiary phone must be 11 digits"),

//   dateOfBirth: z.coerce.date().optional(),

//   relationship: z
//     .string()
//     .min(1, "Relationship is required"),
// });

// export const createSubscriptionValidationSchema = z
//   .object({
//     customer: z.string().optional(),
//     customerPayload: createUserZodSchema.optional(),
//     package: z.string(),

//     planType: z.enum([
//       "MONTHLY",
//       "QUARTERLY",
//       "HALF_YEARLY",
//       "YEARLY",
//       "LIFETIME",
//     ]),

//     durationInMonths: z.number().optional(),

//     price: z.number(),

//     // who the subscription actually covers
//     subscribeFor: z.enum(["SELF", "OTHER"]),
//     beneficiary: beneficiaryZodSchema.optional(),

//     autoRenew: z.boolean().optional(),
//   })




// Version 2 with joint 

import { z } from "zod";
import { createUserZodSchema } from "../user/user.validation";

const beneficiaryZodSchema = z.object({
  name: z.string().min(1, "Beneficiary name is required"),

  phone: z.string().length(11, "Beneficiary phone must be 11 digits"),

  dateOfBirth: z.coerce.date().optional(),

  relationship: z.string().min(1, "Relationship is required"),
});

// Same shape — 2nd covered person on a Joint package.
// Kept optional at the schema level; frontend enforces requiredness
// when the selected package is Joint.
const joinMemberZodSchema = z.object({
  name: z.string().min(1, "Join member name is required"),

  phone: z.string().length(11, "Join member phone must be 11 digits"),

  dateOfBirth: z.coerce.date().optional(),

  relationship: z.string().min(1, "Relationship is required"),
});

const nomineeZodSchema = z.object({
  source: z.enum(["JOIN_MEMBER", "OTHER"]).optional(),

  name: z.string().min(1, "Nominee name is required"),

  phone: z.string().length(11, "Nominee phone must be 11 digits"),

  dateOfBirth: z.coerce.date().optional(),

  relationship: z.string().min(1, "Relationship is required"),
});

export const createSubscriptionValidationSchema = z.object({
  customer: z.string().optional(),
  customerPayload: createUserZodSchema.optional(),
  package: z.string(),

  planType: z.enum([
    "MONTHLY",
    "QUARTERLY",
    "HALF_YEARLY",
    "YEARLY",
    "LIFETIME",
  ]),

  durationInMonths: z.number().optional(),

  price: z.number(),

  // who the subscription actually covers
  subscribeFor: z.enum(["SELF", "OTHER"]),
  beneficiary: beneficiaryZodSchema.optional(),

  // optional for now — required-ness (based on package.isJoint) handled on frontend
  joinMember: joinMemberZodSchema.optional(),

  nominee: nomineeZodSchema.optional(),

  autoRenew: z.boolean().optional(),
});

export const updateSubscriptionValidationSchema = createSubscriptionValidationSchema.partial();