import { z } from "zod";

export const createPartnerBranchSchema =
  z.object({
    partner: z.string(),

    branchName: z.string(),

    phone: z.string().optional(),

    email: z.string().email().optional(),

    address: z.string(),

    city: z.string().optional(),

    area: z.string().optional(),

    postalCode: z.string().optional(),

    location: z.object({
      type: z.literal("Point"),

      coordinates: z
        .array(z.number())
        .length(2),
    }),
  });