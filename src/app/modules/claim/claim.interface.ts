import { Types } from "mongoose";

export enum ClaimStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ClaimTitle {
  OPD = "OPD",
  HOSPITAL_COVERAGE = "HOSPITAL_COVERAGE",
  PREGNANCY_COVERAGE = "PREGNANCY_COVERAGE",
  PARTIAL_DISABILITY = "PARTIAL_DISABILITY",
  PERMANENT_DISABILITY = "PERMANENT_DISABILITY",
  LIFE_COVERAGE = "LIFE_COVERAGE",
}

export enum PaymentMethod {
  BKASH = "BKASH",
  NAGAD = "NAGAD",
  BANK = "BANK",
}

export interface IClaim {
  _id?: Types.ObjectId;

  customer: Types.ObjectId;
  paymentInfo: {
    mobileNumber: string;

    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    branchName: string;
  };
  claimTitle: ClaimTitle;

  subscription: Types.ObjectId;

  paymentMethod: PaymentMethod;

  description: string;

  attachments?: string[];

  status: ClaimStatus;

  adminNote?: string;

  reviewedBy?: Types.ObjectId;

  reviewedAt?: Date;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}
