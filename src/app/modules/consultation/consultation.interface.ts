// import { Types } from "mongoose";

// export enum ConsultationStatus {
//   INITIATED = "INITIATED",
//   ELIGIBLE = "ELIGIBLE",
//   BOOKED = "BOOKED",
//   PAID = "PAID",
//   RINGING = "RINGING",
//   ACCEPTED = "ACCEPTED",
//   REJECTED = "REJECTED",
//   TIMEOUT = "TIMEOUT",
//   COMPLETED = "COMPLETED",
//   CANCELLED = "CANCELLED",
//   POOL_EXHAUSTED = "POOL_EXHAUSTED",
//   FAILED = "FAILED",
// }

// export interface IConsultation {
//   customer: Types.ObjectId;
//   subscription: Types.ObjectId;
//   zaynaxBookingId?: string;
//   zaynaxOrderType?: string;
//   roomId?: string;
//   doctorId?: string;
//   doctorName?: string;
//   status: ConsultationStatus;
//   failureReason?: string;
//   isDeleted: boolean;
// }

// v2

// import { Types } from "mongoose";

// export enum ConsultationStatus {
//   INITIATED = "INITIATED",
//   ELIGIBLE = "ELIGIBLE",
//   BOOKED = "BOOKED",
//   PAID = "PAID",
//   RINGING = "RINGING",
//   ACCEPTED = "ACCEPTED",
//   REJECTED = "REJECTED",
//   TIMEOUT = "TIMEOUT",
//   COMPLETED = "COMPLETED",
//   CANCELLED = "CANCELLED",
//   POOL_EXHAUSTED = "POOL_EXHAUSTED",
//   FAILED = "FAILED",
// }

// export interface IConsultation {
//   customer: Types.ObjectId;
//   subscription: Types.ObjectId;
//   zaynaxBookingId?: string;
//   zaynaxOrderType?: string;
//   roomId?: string;
//   doctorId?: string;
//   doctorName?: string;
//   status: ConsultationStatus;
//   failureReason?: string;
//   // Set when the frontend reports ACCEPTED / COMPLETED respectively.
//   callStartedAt?: Date;
//   callEndedAt?: Date;
//   // Populated whenever a prescription becomes available for this consultation.
//   prescriptionUrl?: string;
//   isDeleted: boolean;
// }


// v3

import { Types } from "mongoose";

export enum ConsultationStatus {
  INITIATED = "INITIATED",
  ELIGIBLE = "ELIGIBLE",
  BOOKED = "BOOKED",
  PAID = "PAID",
  RINGING = "RINGING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  TIMEOUT = "TIMEOUT",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  POOL_EXHAUSTED = "POOL_EXHAUSTED",
  FAILED = "FAILED",
}

export enum PrescriptionStatus {
  NOT_APPLICABLE = "NOT_APPLICABLE", 
  PENDING = "PENDING",               
  READY = "READY",                   
  FAILED = "FAILED",               
}

export interface IConsultation {
  customer: Types.ObjectId;
  subscription: Types.ObjectId;
  zaynaxBookingId?: string;
  zaynaxOrderType?: string;

  zaynaxToken?: string;
  roomId?: string;
  doctorId?: string;
  doctorName?: string;
  status: ConsultationStatus;
  callDurationSeconds?: number;    
  prescriptionStatus: PrescriptionStatus;
  prescriptionAttempts: number;     
  lastPrescriptionCheckAt?: Date;
  failureReason?: string;
  callStartedAt?: Date;
  callEndedAt?: Date;
  prescriptionUrl?: string;
  isDeleted: boolean;
}


