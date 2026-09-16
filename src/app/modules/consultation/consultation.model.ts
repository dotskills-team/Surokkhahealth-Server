// import { Schema, model } from "mongoose";
// import { ConsultationStatus, IConsultation } from "./consultation.interface";

// const consultationSchema = new Schema<IConsultation>(
//   {
//     customer: { type: Schema.Types.ObjectId, ref: "User", required: true },

//     subscription: {
//       type: Schema.Types.ObjectId,
//       ref: "Subscription",
//       required: true,
//     },

//     zaynaxBookingId: { type: String },

//     zaynaxOrderType: { type: String },

//     roomId: { type: String },

//     doctorId: { type: String },

//     doctorName: { type: String },

//     status: {
//       type: String,
//       enum: Object.values(ConsultationStatus),
//       default: ConsultationStatus.INITIATED,
//       required: true,
//     },

//     failureReason: { type: String },

//     isDeleted: { type: Boolean, default: false },
//   },
//   { timestamps: true },
// );

// consultationSchema.index({ customer: 1, createdAt: -1 });

// export const Consultation = model<IConsultation>(
//   "Consultation",
//   consultationSchema,
// );

// v2

// import { Schema, model } from "mongoose";
// import { ConsultationStatus, IConsultation } from "./consultation.interface";

// const consultationSchema = new Schema<IConsultation>(
//   {
//     customer: { type: Schema.Types.ObjectId, ref: "User", required: true },

//     subscription: {
//       type: Schema.Types.ObjectId,
//       ref: "Subscription",
//       required: true,
//     },

//     zaynaxBookingId: { type: String },

//     zaynaxOrderType: { type: String },

//     roomId: { type: String },

//     doctorId: { type: String },

//     doctorName: { type: String },

//     status: {
//       type: String,
//       enum: Object.values(ConsultationStatus),
//       default: ConsultationStatus.INITIATED,
//       required: true,
//     },

//     failureReason: { type: String },

//     callStartedAt: { type: Date },

//     callEndedAt: { type: Date },

//     prescriptionUrl: { type: String },

//     isDeleted: { type: Boolean, default: false },
//   },
//   { timestamps: true },
// );

// consultationSchema.index({ customer: 1, createdAt: -1 });

// export const Consultation = model<IConsultation>(
//   "Consultation",
//   consultationSchema,
// );

// v3

import { Schema, model } from "mongoose";
import {
  ConsultationStatus,
  PrescriptionStatus,
  IConsultation,
} from "./consultation.interface";

const consultationSchema = new Schema<IConsultation>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },

    zaynaxBookingId: { type: String },
    zaynaxOrderType: { type: String },
    zaynaxToken: { type: String, select: false },

    roomId: { type: String },
    doctorId: { type: String },
    doctorName: { type: String },

    status: {
      type: String,
      enum: Object.values(ConsultationStatus),
      default: ConsultationStatus.INITIATED,
      required: true,
    },

    failureReason: { type: String },

    callStartedAt: { type: Date },
    callEndedAt: { type: Date },
    callDurationSeconds: { type: Number },

    prescriptionUrl: { type: String },
    prescriptionStatus: {
      type: String,
      enum: Object.values(PrescriptionStatus),
      default: PrescriptionStatus.NOT_APPLICABLE,
      required: true,
    },
    prescriptionAttempts: { type: Number, default: 0 },
    lastPrescriptionCheckAt: { type: Date },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

consultationSchema.index({ customer: 1, createdAt: -1 });
consultationSchema.index({ status: 1, callStartedAt: 1 });
consultationSchema.index({ prescriptionStatus: 1 });

export const Consultation = model<IConsultation>(
  "Consultation",
  consultationSchema,
);