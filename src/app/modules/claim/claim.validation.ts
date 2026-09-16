import { z } from "zod";
import {
  ClaimStatus,
  ClaimTitle,
  PaymentMethod,
} from "./claim.interface";

export const createClaimValidationSchema = z
  .object({
    customer: z.string().min(1, "Customer is required"),

    subscription: z.string().min(1, "Subscription is required"),

    claimTitle: z.nativeEnum(ClaimTitle, {
      required_error: "Claim title is required",
    }),

    description: z
      .string()
      .min(10, "Description must be at least 10 characters"),

    paymentMethod: z.nativeEnum(PaymentMethod, {
      required_error: "Receive payment method is required",
    }),

    paymentInfo: z
      .object({
        mobileNumber: z.string().optional(),

        bankName: z.string().optional(),

        accountName: z.string().optional(),

        accountNumber: z.string().optional(),

        routingNumber: z.string().optional(),

        branchName: z.string().optional(),
      })
      .optional(),

    attachments: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    // BKASH / NAGAD
    if (
      data.paymentMethod === PaymentMethod.BKASH ||
      data.paymentMethod === PaymentMethod.NAGAD
    ) {
      if (!data.paymentInfo?.mobileNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "mobileNumber"],
          message: "Mobile number is required.",
        });
      }
    }

    // BANK
    if (data.paymentMethod === PaymentMethod.BANK) {
      const bank = data.paymentInfo;

      if (!bank?.bankName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "bankName"],
          message: "Bank name is required.",
        });
      }

      if (!bank?.accountName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "accountName"],
          message: "Account holder name is required.",
        });
      }

      if (!bank?.accountNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "accountNumber"],
          message: "Account number is required.",
        });
      }

      if (!bank?.routingNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "routingNumber"],
          message: "Routing number is required.",
        });
      }

      if (!bank?.branchName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "branchName"],
          message: "Branch name is required.",
        });
      }
    }
  });

export const updateClaimValidationSchema = z
  .object({
    claimTitle: z.nativeEnum(ClaimTitle).optional(),

    description: z.string().min(10).optional(),

    paymentMethod: z.nativeEnum(PaymentMethod).optional(),

    paymentInfo: z
      .object({
        mobileNumber: z.string().optional(),

        bankName: z.string().optional(),

        accountName: z.string().optional(),

        accountNumber: z.string().optional(),

        routingNumber: z.string().optional(),

        branchName: z.string().optional(),
      })
      .optional(),

    attachments: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.paymentMethod) return;

    if (
      data.paymentMethod === PaymentMethod.BKASH ||
      data.paymentMethod === PaymentMethod.NAGAD
    ) {
      if (!data.paymentInfo?.mobileNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "mobileNumber"],
          message: "Mobile number is required.",
        });
      }
    }

    if (data.paymentMethod === PaymentMethod.BANK) {
      const bank = data.paymentInfo;

      if (!bank?.bankName)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "bankName"],
          message: "Bank name is required.",
        });

      if (!bank?.accountName)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "accountName"],
          message: "Account holder name is required.",
        });

      if (!bank?.accountNumber)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "accountNumber"],
          message: "Account number is required.",
        });

      if (!bank?.routingNumber)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "routingNumber"],
          message: "Routing number is required.",
        });

      if (!bank?.branchName)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentInfo", "branchName"],
          message: "Branch name is required.",
        });
    }
  });

export const reviewClaimValidationSchema = z.object({
  status: z.enum([
    ClaimStatus.APPROVED,
    ClaimStatus.REJECTED,
  ]),

  adminNote: z.string().optional(),
});