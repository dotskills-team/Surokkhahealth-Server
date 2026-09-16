import { z } from "zod";
import { PartnerCategory } from "./partner.interface";

export const createPartnerZodSchema = z.object({
  name: z.string().min(2),

  logo: z.string().optional(),
  category: z.nativeEnum(PartnerCategory).optional(),

  description: z.string().optional(),

  phone: z.string().optional(),

  email: z.string().email().optional(),

  website: z.string().optional(),
});

export const updatePartnerZodSchema = createPartnerZodSchema.partial();