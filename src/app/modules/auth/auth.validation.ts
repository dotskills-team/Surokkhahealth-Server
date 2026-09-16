import { z } from "zod";

const bdPhoneRegex = /^(?:\+8801|01)[3-9]\d{8}$/;

export const staffLoginZodSchema = z.object({
  phone: z
    .string({ invalid_type_error: "Phone number must be string" })
    .regex(bdPhoneRegex, {
      message:
        "Phone number must be valid for Bangladesh. Example: 017XXXXXXXX or +88017XXXXXXXX",
    }),

  password: z.string({ invalid_type_error: "Password must be string" }).min(8, {
    message: "Password must be at least 8 characters long.",
  }),
});

export const sendOtpZodSchema = z.object({
  phone: z
    .string({ invalid_type_error: "Phone number must be string" })
    .regex(bdPhoneRegex, {
      message:
        "Phone number must be valid for Bangladesh. Example: 017XXXXXXXX or +88017XXXXXXXX",
    }),
});

export const verifyOtpZodSchema = z.object({
  phone: z
    .string({ invalid_type_error: "Phone number must be string" })
    .regex(bdPhoneRegex, {
      message:
        "Phone number must be valid for Bangladesh. Example: 017XXXXXXXX or +88017XXXXXXXX",
    }),

  otp: z.string({ invalid_type_error: "OTP must be string" }).regex(/^\d{6}$/, {
    message: "OTP must be exactly 6 digits",
  }),
});

export const changePasswordZodSchema = z.object({
  oldPassword: z
    .string({ invalid_type_error: "Old password must be string" })
    .min(8, {
      message: "Old password must be at least 8 characters long.",
    }),

  newPassword: z
    .string({ invalid_type_error: "New password must be string" })
    .min(8, {
      message: "New password must be at least 8 characters long.",
    }),
});

export const setPasswordZodSchema = z.object({
  password: z
    .string({ invalid_type_error: "Password must be string" })
    .min(8, { message: "Password must be at least 8 characters long" }),
});
