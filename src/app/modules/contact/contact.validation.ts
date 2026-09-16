import { z } from "zod";

export const createContactZodSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(11),
  email: z.string().email().optional(),

  subject: z.string().optional(),
  message: z.string().min(5),

  userId: z.string().optional(),
  relatedPackage: z.string().optional(),
  relatedPartner: z.string().optional(),
});

export const updateContactZodSchema = createContactZodSchema.partial().extend({
  isRead: z.boolean().optional(),
  isReplied: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});