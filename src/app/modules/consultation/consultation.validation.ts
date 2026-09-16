// import { z } from "zod";
// import { ConsultationStatus } from "./consultation.interface";

// export const updateConsultationStatusValidationSchema = z.object({
//   status: z.nativeEnum(ConsultationStatus),
// });


import { z } from "zod";
import { ConsultationStatus } from "./consultation.interface";

export const updateConsultationStatusValidationSchema = z.object({
  status: z.nativeEnum(ConsultationStatus),
  callStartedAt: z.string().datetime().optional(),
  callEndedAt: z.string().datetime().optional(),
  prescriptionUrl: z.string().url().optional(),
});